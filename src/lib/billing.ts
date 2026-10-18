import { env } from 'cloudflare:workers';
import { and, eq, isNotNull, or } from 'drizzle-orm';
import Stripe from 'stripe';
import { listings, type Listing } from '../db/schema';
import { PAID_TIERS, tierForSubscription, type PaidTier, type TierConfig } from './billing-tier';
import { db } from './db';

type BillingEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_FEATURED?: string;
  STRIPE_PRICE_PREMIUM?: string;
  /** Test only: point the SDK at a local mock API, e.g. http://127.0.0.1:12111. Ignored for live keys. */
  STRIPE_API_BASE?: string;
};
const benv = () => env as BillingEnv;

export const tierConfig = (): TierConfig => ({ featured: benv().STRIPE_PRICE_FEATURED, premium: benv().STRIPE_PRICE_PREMIUM });

/** Billing works only with a secret key and at least one configured tier. */
export const billingEnabled = () => !!benv().STRIPE_SECRET_KEY && PAID_TIERS.some((t) => tierConfig()[t]);

let client: Stripe | undefined;
export function stripe(): Stripe {
  if (client) return client;
  const key = benv().STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  const base = benv().STRIPE_API_BASE;
  const mock = base && key.startsWith('sk_test_') ? new URL(base) : null;
  client = new Stripe(key, {
    maxNetworkRetries: 2,
    ...(mock ? { host: mock.hostname, port: Number(mock.port), protocol: mock.protocol.replace(':', '') as 'http' | 'https' } : {}),
  });
  return client;
}

/** The checkout price for a tier. A configured product id resolves to that product's default price. */
async function priceIdFor(tier: PaidTier): Promise<string> {
  const id = tierConfig()[tier];
  if (!id) throw new Error(`No Stripe price configured for ${tier}`);
  if (!id.startsWith('prod_')) return id;
  const product = await stripe().products.retrieve(id);
  const price = typeof product.default_price === 'string' ? product.default_price : product.default_price?.id;
  if (!price) throw new Error(`Stripe product ${id} has no default price`);
  return price;
}

/** "$29/month" per tier for the upgrade buttons. Cached per isolate; missing on any Stripe error. */
let priceLabels: Partial<Record<PaidTier, string>> | undefined;
export async function tierPriceLabels(): Promise<Partial<Record<PaidTier, string>>> {
  if (priceLabels) return priceLabels;
  const out: Partial<Record<PaidTier, string>> = {};
  for (const tier of PAID_TIERS) {
    if (!tierConfig()[tier]) continue;
    try {
      const p = await stripe().prices.retrieve(await priceIdFor(tier));
      if (p.unit_amount != null) {
        const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency.toUpperCase() }).format(p.unit_amount / 100);
        out[tier] = p.recurring ? `${amount}/${p.recurring.interval_count > 1 ? `${p.recurring.interval_count} ${p.recurring.interval}s` : p.recurring.interval}` : amount;
      }
    } catch (err) {
      console.error(`Could not load Stripe price for ${tier}`, err);
      return out; // do not cache a partial result
    }
  }
  return (priceLabels = out);
}

/** True while the listing has a subscription Stripe still bills (change it in the portal, not a new checkout). */
export const hasLiveSubscription = (l: Pick<Listing, 'stripeSubscriptionId' | 'subscriptionStatus'>) =>
  !!l.stripeSubscriptionId && !!l.subscriptionStatus && !['canceled', 'incomplete_expired'].includes(l.subscriptionStatus);

/** Reuse the owner's Stripe customer from any of their listings, so one portal shows all their plans. */
async function customerFor(ownerUserId: string, email: string): Promise<string> {
  const row = (
    await db()
      .select({ id: listings.stripeCustomerId })
      .from(listings)
      .where(and(eq(listings.ownerUserId, ownerUserId), isNotNull(listings.stripeCustomerId)))
      .limit(1)
  )[0];
  if (row?.id) return row.id;
  const customer = await stripe().customers.create({ email, metadata: { clerk_user_id: ownerUserId } });
  return customer.id;
}

/** A Checkout session (subscription mode) for upgrading one listing. Returns the URL to redirect to. */
export async function createCheckout(listing: Listing, tier: PaidTier, user: { id: string; email: string }, origin: string) {
  const customer = listing.stripeCustomerId ?? (await customerFor(user.id, user.email));
  if (listing.stripeCustomerId !== customer) {
    await db().update(listings).set({ stripeCustomerId: customer }).where(eq(listings.id, listing.id));
  }
  const metadata = { listing_id: String(listing.id), tier, clerk_user_id: user.id };
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: await priceIdFor(tier), quantity: 1 }],
    client_reference_id: String(listing.id),
    metadata,
    // Copied onto the subscription, so every later subscription event names its listing.
    subscription_data: { metadata },
    success_url: `${origin}/account?done=upgraded`,
    cancel_url: `${origin}/account?done=upgrade-cancelled`,
  });
  if (!session.url) throw new Error('Stripe returned no checkout URL');
  return session.url;
}

/** Stripe customer portal for managing cards, invoices, plan changes, and cancellation. */
export async function createPortal(customer: string, origin: string) {
  const session = await stripe().billingPortal.sessions.create({ customer, return_url: `${origin}/account` });
  return session.url;
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : v?.id ?? null);

/**
 * Bring a listing in line with a subscription's current state in Stripe. The subscription is
 * always re-read from Stripe, so events arriving late, twice, or out of order still end correct.
 * Tier drops to free when Stripe stops billing; the listing itself is never removed or unpublished.
 */
export async function syncSubscription(subscriptionId: string, hint?: { listingId?: number; customerId?: string | null }) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const metaId = Number(sub.metadata?.listing_id);
  const listingId = hint?.listingId ?? (Number.isInteger(metaId) && metaId > 0 ? metaId : undefined);
  const target = listingId
    ? or(eq(listings.id, listingId), eq(listings.stripeSubscriptionId, sub.id))
    : eq(listings.stripeSubscriptionId, sub.id);
  const listing = (await db().select().from(listings).where(target).limit(1))[0];
  if (!listing) {
    console.warn(`Stripe subscription ${sub.id}: no listing found (metadata listing_id=${sub.metadata?.listing_id ?? 'none'})`);
    return null;
  }
  // A listing keeps one subscription. An older one finishing must not downgrade a newer one.
  if (listing.stripeSubscriptionId && listing.stripeSubscriptionId !== sub.id && hasLiveSubscription(listing) && !['active', 'trialing'].includes(sub.status)) {
    return listing.id;
  }
  if (listing.stripeSubscriptionId && listing.stripeSubscriptionId !== sub.id && hasLiveSubscription(listing)) {
    // e.g. two checkout tabs both paid. Not cancelled automatically: refund/cancel the old one in Stripe.
    console.warn(`Listing ${listing.id}: subscription ${sub.id} replaces still-live ${listing.stripeSubscriptionId}; cancel the old one in Stripe`);
  }
  const tier = tierForSubscription(sub, tierConfig());
  const periodEnds = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === 'number');
  await db()
    .update(listings)
    .set({
      tier,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: idOf(sub.customer) ?? hint?.customerId ?? listing.stripeCustomerId,
      subscriptionStatus: sub.status,
      currentPeriodEnd: periodEnds.length ? new Date(Math.max(...periodEnds) * 1000) : null,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listing.id));
  return listing.id;
}

/** Downgrade right away on a failed payment; a later successful retry restores the tier via subscription.updated. */
async function downgradeForFailedPayment(subscriptionId: string) {
  const listingId = await syncSubscription(subscriptionId);
  if (listingId) await db().update(listings).set({ tier: 'free', updatedAt: new Date() }).where(eq(listings.id, listingId));
}

export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
] as const;

/** Apply one verified webhook event. Returns a short note for the response body and logs. */
export async function handleEvent(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      const subId = idOf(s.subscription);
      if (s.mode !== 'subscription' || !subId) return 'ignored: not a subscription checkout';
      const listingId = Number(s.metadata?.listing_id ?? s.client_reference_id);
      await syncSubscription(subId, { listingId: Number.isInteger(listingId) && listingId > 0 ? listingId : undefined, customerId: idOf(s.customer) });
      return `synced ${subId}`;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await syncSubscription(event.data.object.id);
      return `synced ${event.data.object.id}`;
    }
    case 'invoice.payment_failed': {
      const subId = idOf(event.data.object.parent?.subscription_details?.subscription);
      if (!subId) return 'ignored: invoice has no subscription';
      await downgradeForFailedPayment(subId);
      return `downgraded ${subId}`;
    }
    default:
      return `ignored: ${event.type}`;
  }
}

/** Verify the Stripe-Signature header against the raw body. Throws on a bad or stale signature. */
export async function verifyEvent(rawBody: string, signature: string | null): Promise<Stripe.Event> {
  const secret = benv().STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  if (!signature) throw new Error('Missing Stripe-Signature header');
  return stripe().webhooks.constructEventAsync(rawBody, signature, secret);
}
