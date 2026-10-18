import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDay, parseDay } from './hours-parse.ts';

test('parseDay', () => {
  assert.deepEqual(parseDay('9AM-5PM'), [{ open: '09:00', close: '17:00' }]);
  assert.deepEqual(parseDay('11-2PM, 5-9PM'), [{ open: '11:00', close: '14:00' }, { open: '17:00', close: '21:00' }]);
  assert.deepEqual(parseDay('09:00-17:30'), [{ open: '09:00', close: '17:30' }]);
  assert.deepEqual(parseDay('Closed'), []);
  assert.deepEqual(parseDay('Open 24 hours'), [{ open: '00:00', close: '23:59' }]);
  assert.equal(parseDay('sometimes'), null);
});

test('formatDay round-trips', () => {
  for (const s of ['09:00-17:00', '11:00-14:00, 17:00-21:00', 'Closed', 'Open 24 hours']) {
    assert.equal(formatDay(parseDay(s)!), s);
  }
});
