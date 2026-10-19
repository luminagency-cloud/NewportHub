import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aliasKey, categoryLink, mapSourceCategory, nextBrokenOut } from './category-rules.ts';

test('break out at 5, collapse below 3, hold in between', () => {
  assert.equal(nextBrokenOut(false, 4), false);
  assert.equal(nextBrokenOut(false, 5), true);
  assert.equal(nextBrokenOut(true, 4), true);
  assert.equal(nextBrokenOut(true, 3), true);
  assert.equal(nextBrokenOut(true, 2), false);
  assert.equal(nextBrokenOut(false, 3), false);
});

test('alias keys are forgiving about case, spacing, and ampersands', () => {
  assert.equal(aliasKey('  Bed &  Breakfast '), 'bed and breakfast');
  assert.equal(aliasKey('Farmers’ market'), "farmers' market");
});

test('maps the first known name, else reports the main category', () => {
  const aliases = new Map([['sushi restaurant', 7], ['restaurant', 1]]);
  assert.deepEqual(mapSourceCategory(['Sushi restaurant', 'Restaurant'], aliases), { categoryId: 7 });
  assert.deepEqual(mapSourceCategory(['Poke bar', 'Restaurant'], aliases), { categoryId: 1 });
  assert.deepEqual(mapSourceCategory(['Poke bar', ''], aliases), { unmapped: 'Poke bar' });
  assert.deepEqual(mapSourceCategory([null, undefined], aliases), { unmapped: null });
});

test('narrows a parent hit to a later subtype of the same parent', () => {
  const aliases = new Map([['restaurant', 1], ['breakfast restaurant', 2], ['bar', 10], ['seafood restaurant', 3]]);
  const parentOf = new Map<number, number | null>([[1, null], [2, 1], [3, 1], [10, null]]);
  assert.deepEqual(mapSourceCategory(['Restaurant', 'Breakfast restaurant'], aliases, parentOf), { categoryId: 2 });
  assert.deepEqual(mapSourceCategory(['Bar', 'Restaurant', 'Seafood restaurant'], aliases, parentOf), { categoryId: 10 });
  assert.deepEqual(mapSourceCategory(['Seafood restaurant', 'Breakfast restaurant'], aliases, parentOf), { categoryId: 3 });
});

test('links go to the subcategory only when it has broken out', () => {
  const sub = { slug: 'sushi-restaurants', name: 'Sushi Restaurants', parentSlug: 'restaurants', parentName: 'Restaurants' };
  assert.deepEqual(categoryLink({ ...sub, brokenOut: false }), { slug: 'restaurants', name: 'Restaurants' });
  assert.deepEqual(categoryLink({ ...sub, brokenOut: true }), { slug: 'sushi-restaurants', name: 'Sushi Restaurants' });
  assert.deepEqual(categoryLink({ slug: 'restaurants', name: 'Restaurants', brokenOut: false, parentSlug: null, parentName: null }), { slug: 'restaurants', name: 'Restaurants' });
});
