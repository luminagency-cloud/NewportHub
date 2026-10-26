import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BASIC_DESCRIPTION_LIMIT,
  LEGACY_TIER_MAP,
  descriptionForSave,
  hoursImportedForBasic,
  publicDescription,
  restrictPaidFields,
  shuffle,
  splitCategoryPage,
} from './plans.ts';

test('legacy tier keys: old featured is Plus, old premium is Featured', () => {
  assert.equal(LEGACY_TIER_MAP.free, 'basic');
  assert.equal(LEGACY_TIER_MAP.featured, 'plus');
  assert.equal(LEGACY_TIER_MAP.premium, 'featured');
  assert.notEqual(LEGACY_TIER_MAP.featured, 'featured');
});

test('migration renames old featured to plus before premium reuses the featured name', () => {
  const sql = readFileSync(new URL('../../drizzle/migrations/0011_plan_tiers.sql', import.meta.url), 'utf8');
  const toPlus = sql.indexOf("SET `tier` = 'plus' WHERE `tier` = 'featured'");
  const toFeatured = sql.indexOf("SET `tier` = 'featured' WHERE `tier` = 'premium'");
  const toBasic = sql.indexOf("SET `tier` = 'basic' WHERE `tier` = 'free'");
  assert.ok(toPlus !== -1 && toFeatured !== -1 && toBasic !== -1);
  assert.ok(toPlus < toFeatured);
});

test('Basic public description is about 250 characters and the stored text is kept on save', () => {
  const stored = `${'word '.repeat(80)}tail`;
  assert.ok(stored.length > BASIC_DESCRIPTION_LIMIT);
  const shown = publicDescription(stored, 'basic');
  assert.ok(shown);
  assert.ok(shown.length <= BASIC_DESCRIPTION_LIMIT);
  assert.equal(publicDescription(stored, 'plus'), stored);
  assert.equal(descriptionForSave('basic', shown, stored), stored);
  assert.equal(descriptionForSave('basic', 'A new short line', stored), 'A new short line');
  assert.equal(descriptionForSave('basic', null, stored), null);
  assert.equal(descriptionForSave('plus', stored, stored), stored);
});

test('Basic saves do not change hours or links', () => {
  const stored = {
    description: 'Short',
    hours: { Monday: [{ open: '09:00', close: '17:00' }] },
    socialUrl: 'https://instagram.com/cafe',
    menuUrl: 'https://example.com/menu',
    bookingUrl: 'https://example.com/book',
  };
  const next = restrictPaidFields(
    'basic',
    { ...stored, description: 'Edited', hours: null, socialUrl: null, menuUrl: null, bookingUrl: null },
    stored,
  );
  assert.equal(next.description, 'Edited');
  assert.deepEqual(next.hours, stored.hours);
  assert.equal(next.socialUrl, stored.socialUrl);
  assert.equal(next.menuUrl, stored.menuUrl);
  assert.equal(next.bookingUrl, stored.bookingUrl);

  const paid = restrictPaidFields('plus', { ...stored, hours: null, socialUrl: null, menuUrl: null, bookingUrl: null }, stored);
  assert.equal(paid.hours, null);
  assert.equal(paid.socialUrl, null);
});

test('Basic import drops hours even when the export has them', () => {
  assert.equal(hoursImportedForBasic('{"Monday":"9AM-5PM"}'), null);
  assert.equal(hoursImportedForBasic(null), null);
});

test('category page keeps Featured in the main list and Basic at the bottom', () => {
  const rows = [
    { tier: 'featured' as const, name: 'Ada' },
    { tier: 'plus' as const, name: 'Bea' },
    { tier: 'basic' as const, name: 'Cy' },
    { tier: 'basic' as const, name: 'Dee' },
  ];
  const split = splitCategoryPage(rows);
  assert.deepEqual(split.main.map((r) => r.name), ['Ada', 'Bea']);
  assert.deepEqual(split.basic.map((r) => r.name), ['Cy', 'Dee']);
  assert.ok(split.main.some((r) => r.tier === 'featured'));
});

test('shuffle keeps every item and uses the supplied random source', () => {
  const items = ['a', 'b', 'c', 'd'];
  let n = 0;
  const shuffled = shuffle(items, () => {
    n += 1;
    return 0;
  });
  assert.equal(n, 3);
  assert.deepEqual([...shuffled].sort(), items);
  assert.notDeepEqual(shuffled, items);
});
