/** Turn the listing form's photo fields into the next cover and extras, uploading new files to R2. */
import { deleteMedia, uploadLogo } from './media';
import { nextPhotos, type PhotoSet } from './photos';
import { MAX_EXTRA_PHOTOS } from './plans';

export interface PhotoFormInput {
  allowExtras: boolean;
  removeCover: boolean;
  promoteKey: string | null;
  removeExtraKeys: string[];
  logoFile: FormDataEntryValue | null;
  photoFiles: FormDataEntryValue[];
}

export function photoFormInput(form: FormData, allowExtras: boolean): PhotoFormInput {
  const promote = String(form.get('promote') ?? '').trim();
  return {
    allowExtras,
    removeCover: form.get('removeLogo') === 'yes',
    promoteKey: promote || null,
    removeExtraKeys: form.getAll('removePhoto').map((v) => String(v)).filter(Boolean),
    logoFile: form.get('logo'),
    photoFiles: form.getAll('photos'),
  };
}

const realFile = (f: FormDataEntryValue): f is File => f instanceof File && f.size > 0;

/**
 * Apply a photo form to `current`. On any upload or count error, new objects are deleted and
 * `current` is returned unchanged.
 */
export async function applyPhotoForm(
  listingId: number,
  current: PhotoSet,
  input: PhotoFormInput,
): Promise<{ photos: PhotoSet; error?: string }> {
  const files = input.allowExtras ? input.photoFiles.filter(realFile) : [];
  if (input.allowExtras) {
    const removing = new Set(input.removeExtraKeys);
    const kept = current.extras.filter((key) => !removing.has(key));
    if (kept.length + files.length > MAX_EXTRA_PHOTOS) {
      return { photos: current, error: `You can add up to ${MAX_EXTRA_PHOTOS} photos besides the cover.` };
    }
  }

  const logo = await uploadLogo(input.logoFile, listingId);
  if (logo.error) return { photos: current, error: logo.error };

  const added: string[] = [];
  for (const file of files) {
    const up = await uploadLogo(file, listingId);
    if (up.error || !up.key) {
      if (logo.key) await deleteMedia(logo.key);
      for (const key of added) await deleteMedia(key);
      return { photos: current, error: up.error ?? 'That photo could not be saved.' };
    }
    added.push(up.key);
  }

  const result = nextPhotos(current, {
    allowExtras: input.allowExtras,
    removeExtraKeys: input.removeExtraKeys,
    addedExtraKeys: added,
    promoteKey: logo.key ? null : input.promoteKey,
    replacementCoverKey: logo.key,
    removeCover: input.removeCover && !logo.key,
  });
  if (result.error) {
    if (logo.key) await deleteMedia(logo.key);
    for (const key of added) await deleteMedia(key);
    return { photos: current, error: result.error };
  }
  return { photos: result.photos };
}
