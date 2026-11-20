import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleProfileUrl, parseSocialForm, parseSocialUrl, socialEntries } from './social.ts';

test('parseSocialUrl normalizes profile links', () => {
  assert.deepEqual(parseSocialUrl('facebook', 'facebook.com/BlackPearlNewport/'), { url: 'https://facebook.com/BlackPearlNewport' });
  assert.deepEqual(parseSocialUrl('instagram', 'http://www.instagram.com/shop#top'), { url: 'https://www.instagram.com/shop' });
  assert.deepEqual(parseSocialUrl('x', 'https://twitter.com/shop'), { url: 'https://twitter.com/shop' });
  assert.deepEqual(parseSocialUrl('facebook', '  '), { url: null });
});

test('parseSocialUrl rejects other hosts, look-alikes, and bare home pages', () => {
  assert.ok('error' in parseSocialUrl('facebook', 'https://instagram.com/shop'));
  assert.ok('error' in parseSocialUrl('facebook', 'https://notfacebook.com/shop'));
  assert.ok('error' in parseSocialUrl('facebook', 'https://facebook.com.evil.example/shop'));
  assert.ok('error' in parseSocialUrl('instagram', 'https://instagram.com/'));
  assert.ok('error' in parseSocialUrl('youtube', 'not a url at all'));
});

test('parseSocialForm collects set links and errors', () => {
  const f = new FormData();
  f.set('social_facebook', 'facebook.com/shop');
  f.set('social_instagram', '');
  f.set('social_tiktok', 'https://example.com/x');
  const r = parseSocialForm(f);
  assert.deepEqual(r.social, { facebook: 'https://facebook.com/shop' });
  assert.equal(r.errors.length, 1);
  assert.deepEqual(parseSocialForm(new FormData()), { social: null, errors: [] });
});

test('socialEntries keeps display order', () => {
  assert.deepEqual(socialEntries({ instagram: 'https://instagram.com/a', facebook: 'https://facebook.com/a' }).map((e) => e.key), ['facebook', 'instagram']);
  assert.deepEqual(socialEntries(null), []);
});

test('googleProfileUrl needs a real place id', () => {
  const url = googleProfileUrl('ChIJabc123', 'Corner Cafe', '1 Main St, Newport, RI');
  assert.equal(url, 'https://www.google.com/maps/search/?api=1&query=Corner%20Cafe%2C%201%20Main%20St%2C%20Newport%2C%20RI&query_place_id=ChIJabc123');
  assert.equal(googleProfileUrl('0x89e5af:0x1a2b3c', 'Corner Cafe', null), null);
  assert.equal(googleProfileUrl(null, 'Corner Cafe', null), null);
});
