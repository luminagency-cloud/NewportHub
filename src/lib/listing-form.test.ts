import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffChanges, parseListingForm } from './listing-form.ts';

const opts = { categoryIds: new Set([1]), townIds: new Set([2]), allowSuggestions: false };
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ name: 'Cafe', categoryId: '1', townId: '2', ...fields })) f.set(k, v);
  return f;
};

test('website is normalized without a spurious trailing slash', () => {
  assert.equal(parseListingForm(form({ website: 'example.com' }), opts).values.website, 'https://example.com');
  assert.equal(parseListingForm(form({ website: 'https://example.com/menu' }), opts).values.website, 'https://example.com/menu');
  assert.ok(parseListingForm(form({ website: 'not a site' }), opts).errors.length);
});

test('suggestions only when allowed', () => {
  const f = form({ categoryId: 'new', suggestedCategory: 'Kayaks' });
  assert.deepEqual(parseListingForm(f, opts).errors, ['Choose a category.']);
  const v = parseListingForm(f, { ...opts, allowSuggestions: true }).values;
  assert.equal(v.categoryId, null);
  assert.equal(v.suggestedCategory, 'Kayaks');
});

test('diffChanges keeps only changed fields', () => {
  const current = { name: 'Cafe', phone: '1', website: 'https://example.com', hours: null };
  assert.deepEqual(diffChanges(current, { name: 'Cafe', phone: '2', website: 'https://example.com', hours: null }), { phone: '2' });
});
