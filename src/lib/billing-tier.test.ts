import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierForSubscription } from './billing-tier.ts';

const config = { featured: 'price_feat', premium: 'prod_prem' };
const sub = (status: string, ...prices: [string, string][]) => ({
  status,
  items: { data: prices.map(([id, product]) => ({ price: { id, product } })) },
});

test('active subscriptions map by price id or product id', () => {
  assert.equal(tierForSubscription(sub('active', ['price_feat', 'prod_x']), config), 'featured');
  assert.equal(tierForSubscription(sub('trialing', ['price_other', 'prod_prem']), config), 'premium');
});

test('not paying means free; the listing is never removed, only downgraded', () => {
  for (const s of ['past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused']) {
    assert.equal(tierForSubscription(sub(s, ['price_feat', 'prod_x']), config), 'free', s);
  }
});

test('unknown prices are free; highest tier wins', () => {
  assert.equal(tierForSubscription(sub('active', ['price_unknown', 'prod_unknown']), config), 'free');
  assert.equal(tierForSubscription(sub('active', ['price_feat', 'prod_x'], ['price_y', 'prod_prem']), config), 'premium');
});
