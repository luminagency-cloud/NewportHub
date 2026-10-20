import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeSlugProblem, slugify } from './slug.ts';

test('slugify makes URL names', () => {
  assert.equal(slugify('Cafés & Bakeries'), 'cafes-and-bakeries');
  assert.equal(slugify('  Little Compton '), 'little-compton');
});

test('placeSlugProblem accepts plain slugs', () => {
  assert.equal(placeSlugProblem('sushi-restaurants'), null);
  assert.equal(placeSlugProblem('auto-parts-2'), null);
});

test('placeSlugProblem rejects empty, malformed, long, and reserved slugs', () => {
  assert.match(placeSlugProblem('')!, /empty/);
  assert.match(placeSlugProblem('Sushi')!, /lower-case/);
  assert.match(placeSlugProblem('sushi--bars')!, /single hyphens/);
  assert.match(placeSlugProblem('-sushi')!, /single hyphens/);
  assert.match(placeSlugProblem('a'.repeat(81))!, /80/);
  assert.match(placeSlugProblem('admin')!, /reserved/);
  assert.match(placeSlugProblem('go')!, /reserved/);
});
