/** Cover + up to 3 extra photos. Pure, so downgrade behaviour can be unit-tested. */
import { MAX_EXTRA_PHOTOS, type Tier, isPaid } from './plans';

export interface PhotoSet {
  /** Cover image. This is the listing logo. */
  cover: string | null;
  extras: string[];
}

export interface PhotoAction {
  /** Plus and Featured. Basic keeps extras stored but cannot add, remove, or promote them. */
  allowExtras: boolean;
  removeExtraKeys: string[];
  addedExtraKeys: string[];
  /** An extra key to swap into the cover. Ignored when a new cover file was uploaded. */
  promoteKey: string | null;
  replacementCoverKey: string | null;
  removeCover: boolean;
}

export function emptyPhotos(): PhotoSet {
  return { cover: null, extras: [] };
}

export function photoKeySet(cover: string | null | undefined, extras: readonly string[] | null | undefined): Set<string> {
  const keys = new Set<string>();
  if (cover) keys.add(cover);
  for (const key of extras ?? []) if (key) keys.add(key);
  return keys;
}

/** Keys in `before` that `after` no longer uses. Callers delete these from R2 when they are not still live. */
export function unusedPhotoKeys(before: ReadonlySet<string>, after: ReadonlySet<string>): string[] {
  return [...before].filter((key) => !after.has(key));
}

/**
 * Next cover and extras. Does not delete anything: the caller compares key sets.
 * Basic listings can still replace or remove the one cover image.
 */
export function nextPhotos(current: PhotoSet, action: PhotoAction): { photos: PhotoSet; error?: string } {
  let extras = [...current.extras];
  let cover = current.cover;

  if (action.allowExtras) {
    const removing = new Set(action.removeExtraKeys);
    extras = extras.filter((key) => !removing.has(key));
    for (const key of action.addedExtraKeys) {
      if (!key || key === cover || extras.includes(key)) continue;
      if (extras.length >= MAX_EXTRA_PHOTOS) {
        return { photos: current, error: `You can add up to ${MAX_EXTRA_PHOTOS} photos besides the cover.` };
      }
      extras.push(key);
    }
  }

  if (action.replacementCoverKey) {
    cover = action.replacementCoverKey;
  } else if (action.removeCover) {
    cover = null;
  } else if (action.allowExtras && action.promoteKey && extras.includes(action.promoteKey)) {
    const promoted = action.promoteKey;
    extras = extras.filter((key) => key !== promoted);
    if (cover && cover !== promoted) extras.unshift(cover);
    cover = promoted;
  }

  extras = extras.filter((key) => key !== cover);
  return { photos: { cover, extras } };
}

export function allowExtraPhotos(tier: Tier): boolean {
  return isPaid(tier);
}
