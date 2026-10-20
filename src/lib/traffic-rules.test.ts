import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayRange, daysBefore, parseTrackBody } from './traffic-rules.ts';

test('track body accepts a listing id and an outbound kind only', () => {
  assert.deepEqual(parseTrackBody('{"l":12,"k":"website"}'), { listingId: 12, kind: 'website' });
  assert.equal(parseTrackBody('{"l":12,"k":"view"}'), null);
  assert.equal(parseTrackBody('{"l":"12","k":"phone"}'), null);
  assert.equal(parseTrackBody('{"l":-1,"k":"phone"}'), null);
  assert.equal(parseTrackBody('{"l":3,"k":"hack"}'), null);
  assert.equal(parseTrackBody('not json'), null);
});

test('day ranges default to the last 30 days and swap when reversed', () => {
  assert.equal(daysBefore('2026-03-01', 1), '2026-02-28');
  assert.deepEqual(dayRange(null, null, '2026-10-20'), { from: '2026-09-21', to: '2026-10-20' });
  assert.deepEqual(dayRange('2026-10-10', '2026-10-01', '2026-10-20'), { from: '2026-10-01', to: '2026-10-10' });
  assert.deepEqual(dayRange('junk', '2026-10-05', '2026-10-20'), { from: '2026-09-21', to: '2026-10-05' });
});
