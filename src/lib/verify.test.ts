import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchingEmail, websiteHost } from './verify.ts';

test('websiteHost strips scheme and www', () => {
  assert.equal(websiteHost('https://www.Harborlight.com/menu'), 'harborlight.com');
  assert.equal(websiteHost('harborlight.com'), 'harborlight.com');
  assert.equal(websiteHost('not a url'), null);
  assert.equal(websiteHost(null), null);
});

test('matchingEmail', () => {
  assert.equal(matchingEmail(['joe@harborlight.com'], 'https://harborlight.com'), 'joe@harborlight.com');
  assert.equal(matchingEmail(['joe@harborlight.com'], 'https://shop.harborlight.com'), 'joe@harborlight.com');
  assert.equal(matchingEmail(['a@gmail.com', 'joe@HarborLight.com'], 'http://www.harborlight.com'), 'joe@HarborLight.com');
  assert.equal(matchingEmail(['joe@notharborlight.com'], 'https://harborlight.com'), null);
  assert.equal(matchingEmail(['joe@shop.harborlight.com'], 'https://harborlight.com'), null);
  assert.equal(matchingEmail(['x@gmail.com'], 'https://gmail.com'), null);
  assert.equal(matchingEmail(['x@facebook.com'], 'https://facebook.com/harborlight'), null);
  assert.equal(matchingEmail(['joe@harborlight.com'], null), null);
});
