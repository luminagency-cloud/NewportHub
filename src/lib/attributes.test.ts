import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributeBadges, parseAbout } from './attributes.ts';

const about = '{"Accessibility": {"Wheelchair accessible entrance": true, "Wheelchair accessible restroom": false}, "Other": {"Identifies as women-owned": true, "LGBTQ+ friendly": true}}';

test('parseAbout reads Outscraper about JSON', () => {
  assert.deepEqual(parseAbout(about), {
    Accessibility: { 'Wheelchair accessible entrance': true, 'Wheelchair accessible restroom': false },
    Other: { 'Identifies as women-owned': true, 'LGBTQ+ friendly': true },
  });
});

test('parseAbout ignores prose, arrays, bad JSON, and non-boolean values', () => {
  assert.equal(parseAbout('A family bakery since 1952.'), null);
  assert.equal(parseAbout('[1, 2]'), null);
  assert.equal(parseAbout('{not json'), null);
  assert.equal(parseAbout('{"Other": {"Note": "text"}}'), null);
  assert.equal(parseAbout(null), null);
});

test('attributeBadges shows true values with friendly labels', () => {
  assert.deepEqual(attributeBadges(parseAbout(about)), ['Wheelchair accessible entrance', 'Women-owned', 'LGBTQ+ friendly']);
  assert.deepEqual(attributeBadges(null), []);
});
