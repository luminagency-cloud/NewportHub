import type { APIRoute } from 'astro';
import { PAID_TIERS, type PaidTier } from '../../../../lib/billing-tier';
import { billingEnabled, createCheckout, hasLiveSubscription, tierConfig } from '../../../../lib/billing';
import { sessionUser } from '../../../../lib/auth';
import { getListing } from '../../../../lib/owner';

/** POST tier=featured|premium → Stripe Checkout. A listing that already has a plan goes to the portal instead. */
export const POST: APIRoute = async (ctx) => {
  const user = await sessionUser(ctx);
  if (!user) return ctx.redirect('/login', 303);
  const listing = await getListing(Number(ctx.params.id));
  if (!listing || listing.ownerUserId !== user.id) return new Response(null, { status: 404 });
  if (!billingEnabled()) return ctx.redirect('/account?done=billing-unavailable', 303);
  if (listing.status !== 'published') return ctx.redirect('/account?done=upgrade-not-live', 303);
  if (hasLiveSubscription(listing)) return ctx.redirect('/account/billing', 307); // 307 keeps the POST

  const tier = String((await ctx.request.formData()).get('tier')) as PaidTier;
  if (!PAID_TIERS.includes(tier) || !tierConfig()[tier]) return new Response('Unknown tier', { status: 400 });
  try {
    return ctx.redirect(await createCheckout(listing, tier, user, ctx.url.origin), 303);
  } catch (err) {
    console.error('Stripe checkout failed', err);
    return ctx.redirect('/account?done=billing-error', 303);
  }
};
