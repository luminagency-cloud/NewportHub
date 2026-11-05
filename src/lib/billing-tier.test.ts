import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierForPrice, tierForSubscription, type TierConfig } from './billing-tier.ts';

const config: TierConfig = {
  plus: { month: 'price_plus_m', year: 'price_plus_y' },
  featured: { month: 'price_feat_m', year: 'prod_feat' },
};
const sub = (status: string, ...prices: [string, string][]) => ({
  status,
  items: { data: prices.map(([id, product]) => ({ price: { id, product } })) },
});

test('monthly and yearly prices map to the same plan, by price id or product id', () => {
  assert.equal(tierForSubscription(sub('active', ['price_plus_m', 'prod_x']), config), 'plus');
  assert.equal(tierForSubscription(sub('trialing', ['price_plus_y', 'prod_x']), config), 'plus');
  assert.equal(tierForSubscription(sub('active', ['price_other', 'prod_feat']), config), 'featured');
  assert.equal(tierForPrice({ id: 'price_feat_m', product: 'prod_x' }, config), 'featured');
});

test('not paying means Basic; the listing is never removed, only downgraded', () => {
  for (const s of ['past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused']) {
    assert.equal(tierForSubscription(sub(s, ['price_feat_m', 'prod_x']), config), 'basic', s);
  }
});

test('unknown prices are Basic; Featured wins over Plus', () => {
  assert.equal(tierForSubscription(sub('active', ['price_unknown', 'prod_unknown']), config), 'basic');
  assert.equal(
    tierForSubscription(sub('active', ['price_plus_y', 'prod_x'], ['price_y', 'prod_feat']), config),
    'featured',
  );
});
