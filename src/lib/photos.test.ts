import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPhotos, photoKeySet, unusedPhotoKeys, type PhotoSet } from './photos.ts';

const start: PhotoSet = { cover: 'cover', extras: ['a', 'b'] };

test('Basic can replace the cover and cannot change extra photos', () => {
  const replaced = nextPhotos(start, {
    allowExtras: false,
    removeExtraKeys: ['a'],
    addedExtraKeys: ['new'],
    promoteKey: 'a',
    replacementCoverKey: 'logo2',
    removeCover: false,
  });
  assert.deepEqual(replaced.photos, { cover: 'logo2', extras: ['a', 'b'] });

  const kept = nextPhotos(start, {
    allowExtras: false,
    removeExtraKeys: ['a'],
    addedExtraKeys: ['new'],
    promoteKey: 'a',
    replacementCoverKey: null,
    removeCover: false,
  });
  assert.deepEqual(kept.photos, start);
});

test('Plus can add photos, promote a cover, and a downgrade keeps the extras', () => {
  const added = nextPhotos(start, {
    allowExtras: true,
    removeExtraKeys: [],
    addedExtraKeys: ['c'],
    promoteKey: null,
    replacementCoverKey: null,
    removeCover: false,
  });
  assert.deepEqual(added.photos.extras, ['a', 'b', 'c']);

  const overflow = nextPhotos(added.photos, {
    allowExtras: true,
    removeExtraKeys: [],
    addedExtraKeys: ['d'],
    promoteKey: null,
    replacementCoverKey: null,
    removeCover: false,
  });
  assert.ok(overflow.error);
  assert.deepEqual(overflow.photos, added.photos);

  const promoted = nextPhotos(added.photos, {
    allowExtras: true,
    removeExtraKeys: [],
    addedExtraKeys: [],
    promoteKey: 'b',
    replacementCoverKey: null,
    removeCover: false,
  });
  assert.equal(promoted.photos.cover, 'b');
  assert.deepEqual(promoted.photos.extras, ['cover', 'a', 'c']);

  const downgraded = nextPhotos(promoted.photos, {
    allowExtras: false,
    removeExtraKeys: ['a', 'c', 'cover'],
    addedExtraKeys: [],
    promoteKey: 'a',
    replacementCoverKey: null,
    removeCover: false,
  });
  assert.deepEqual(downgraded.photos, promoted.photos);
});

test('unused keys are the ones a save dropped', () => {
  const before = photoKeySet('cover', ['a', 'b']);
  const after = photoKeySet('b', ['cover']);
  assert.deepEqual(unusedPhotoKeys(before, after), ['a']);
});
