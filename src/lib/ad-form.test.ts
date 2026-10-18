import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adDay, isBot, parseAdForm } from './ad-form.ts';

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ name: 'Acme fall', altText: 'Acme sale', linkUrl: 'https://acme.example/x', placement: 'home_top', startDate: '2026-11-01', endDate: '2026-11-30', active: 'on', ...o })) f.set(k, v);
  return f;
};

test('valid ad form', () => {
  const { values, errors } = parseAdForm(form({}));
  assert.deepEqual(errors, []);
  assert.equal(values.active, true);
});

test('rejects bad link, placement, and date order', () => {
  assert.ok(parseAdForm(form({ linkUrl: 'javascript:alert(1)' })).errors.some((e) => e.startsWith('Link')));
  assert.ok(parseAdForm(form({ placement: 'footer' })).errors.includes('Choose a placement.'));
  assert.ok(parseAdForm(form({ endDate: '2026-10-01' })).errors.some((e) => e.startsWith('End date')));
});

test('ad day uses New York time', () => {
  assert.equal(adDay(new Date('2026-11-02T03:30:00Z')), '2026-11-01'); // 22:30 EST the day before
  assert.equal(adDay(new Date('2026-07-01T12:00:00Z')), '2026-07-01');
});

test('bots are not counted', () => {
  assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(isBot(null), true);
  assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36'), false);
});
