/** Pure tier rules for Stripe subscriptions. No runtime imports, so it is unit-testable. */

export type PaidTier = 'plus' | 'featured';
export const PAID_TIERS: PaidTier[] = ['plus', 'featured'];

export const BILLING_INTERVALS = ['month', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Configured Stripe ids: a price id (price_…) or a product id (prod_…), per plan per interval. */
export type TierConfig = Partial<Record<PaidTier, Partial<Record<BillingInterval, string>>>>;

/** Statuses that keep the paid tier. Everything else (past_due, unpaid, canceled, incomplete…) is Basic. */
const PAYING = new Set(['active', 'trialing']);

export interface SubscriptionLike {
  status: string;
  items: { data: { price: { id: string; product: string | { id: string } } }[] };
}

export function isBillingInterval(value: string): value is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(value);
}

/** The paid tier a subscription's price belongs to, or null if it matches no configured price. */
export function tierForPrice(price: { id: string; product: string | { id: string } }, config: TierConfig): PaidTier | null {
  const product = typeof price.product === 'string' ? price.product : price.product.id;
  let found: PaidTier | null = null;
  for (const tier of PAID_TIERS) {
    for (const interval of BILLING_INTERVALS) {
      const id = config[tier]?.[interval];
      if (id && (id === price.id || id === product)) found = tier;
    }
  }
  return found;
}

/**
 * The listing tier a subscription grants right now. Not paying, or a price we do not recognise,
 * means Basic. When several items match, Featured wins over Plus. Month and year are the same tier.
 */
export function tierForSubscription(sub: SubscriptionLike, config: TierConfig): 'basic' | PaidTier {
  if (!PAYING.has(sub.status)) return 'basic';
  const tiers = sub.items.data.map((i) => tierForPrice(i.price, config));
  if (tiers.includes('featured')) return 'featured';
  if (tiers.includes('plus')) return 'plus';
  return 'basic';
}

/** True when this plan and interval has a configured Stripe id. */
export function priceConfigured(config: TierConfig, tier: PaidTier, interval: BillingInterval): boolean {
  return !!config[tier]?.[interval];
}
