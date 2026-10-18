/** Pure tier rules for Stripe subscriptions. No runtime imports, so it is unit-testable. */

export type PaidTier = 'featured' | 'premium';
export const PAID_TIERS: PaidTier[] = ['featured', 'premium'];

/** Configured Stripe ids per tier: a price id (price_…) or a product id (prod_…). */
export type TierConfig = Partial<Record<PaidTier, string>>;

/** Statuses that keep the paid tier. Everything else (past_due, unpaid, canceled, incomplete…) is free. */
const PAYING = new Set(['active', 'trialing']);

export interface SubscriptionLike {
  status: string;
  items: { data: { price: { id: string; product: string | { id: string } } }[] };
}

/** The paid tier a subscription's price belongs to, or null if it matches no configured tier. */
export function tierForPrice(price: { id: string; product: string | { id: string } }, config: TierConfig): PaidTier | null {
  const product = typeof price.product === 'string' ? price.product : price.product.id;
  for (const tier of PAID_TIERS) {
    const id = config[tier];
    if (id && (id === price.id || id === product)) return tier;
  }
  return null;
}

/**
 * The listing tier a subscription grants right now. Not paying, or a price we do not recognise,
 * means free. When several items match, the highest tier wins.
 */
export function tierForSubscription(sub: SubscriptionLike, config: TierConfig): 'free' | PaidTier {
  if (!PAYING.has(sub.status)) return 'free';
  const tiers = sub.items.data.map((i) => tierForPrice(i.price, config));
  if (tiers.includes('premium')) return 'premium';
  if (tiers.includes('featured')) return 'featured';
  return 'free';
}
