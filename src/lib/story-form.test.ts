import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateToDay, dayToDate, paragraphs, parseListingRef, parseStoryForm } from './story-form.ts';

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const base = { listing: 'corner-cafe-newport', title: 'Coffee at the corner', summary: 'Twenty years of mornings.', body: 'One.\r\n\r\nTwo.' };

test('parseStoryForm accepts a draft without owner approval', () => {
  const r = parseStoryForm(form({ ...base, status: 'draft' }));
  assert.deepEqual(r.errors, []);
  assert.equal(r.values.body, 'One.\n\nTwo.');
  assert.equal(r.values.slug, '');
  assert.equal(r.values.pullQuote, null);
});

test('parseStoryForm will not publish without the owner approval date', () => {
  const r = parseStoryForm(form({ ...base, status: 'published' }));
  assert.ok(r.errors.some((e) => /owner has approved/.test(e)));
  const ok = parseStoryForm(form({ ...base, status: 'published', ownerApprovedOn: '2026-11-20' }));
  assert.deepEqual(ok.errors, []);
});

test('parseStoryForm requires the main fields and checks the date and status', () => {
  const r = parseStoryForm(form({ status: 'live', ownerApprovedOn: '2026-13-45' }));
  assert.equal(r.errors.length, 6);
  assert.equal(r.values.ownerApprovedOn, null);
});

test('parseStoryForm slugifies the URL name', () => {
  assert.equal(parseStoryForm(form({ ...base, slug: 'Coffee & Corners!' })).values.slug, 'coffee-and-corners');
});

test('parseListingRef reads ids, slugs, and listing links', () => {
  assert.deepEqual(parseListingRef('42'), { id: 42 });
  assert.deepEqual(parseListingRef('Corner-Cafe-Newport'), { slug: 'corner-cafe-newport' });
  assert.deepEqual(parseListingRef('https://newporthub.com/listing/corner-cafe-newport?x=1'), { slug: 'corner-cafe-newport' });
  assert.equal(parseListingRef('0'), null);
  assert.equal(parseListingRef('not a slug'), null);
});

test('paragraphs splits on blank lines only', () => {
  assert.deepEqual(paragraphs('A\nstill A\n\n\nB\r\n\r\n  \n'), ['A\nstill A', 'B']);
});

test('approval day round-trips without shifting', () => {
  assert.equal(dateToDay(dayToDate('2026-11-20')), '2026-11-20');
  assert.equal(dateToDay(null), null);
});
