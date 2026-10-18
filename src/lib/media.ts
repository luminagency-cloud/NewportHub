import { env } from 'cloudflare:workers';

export const MAX_LOGO_BYTES = 1024 * 1024;

/** Sniff the real image type from magic bytes; the browser-sent content type is not trusted. SVG is refused (script risk). */
function sniff(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP')
    return { ext: 'webp', type: 'image/webp' };
  return null;
}

export const MAX_BANNER_BYTES = 2 * 1024 * 1024;

/**
 * Store an uploaded image in R2 under `<prefix>/<uuid>.<ext>`. Returns the new key, null when no
 * file was chosen, or an error message. Keys are unique per upload so a new image never
 * overwrites one that is live.
 */
export async function uploadImage(
  file: FormDataEntryValue | null,
  prefix: string,
  opts: { maxBytes: number; label: string },
): Promise<{ key: string | null; error?: string }> {
  if (!(file instanceof File) || file.size === 0) return { key: null };
  if (file.size > opts.maxBytes) return { key: null, error: `${opts.label} must be ${opts.maxBytes / 1024 / 1024} MB or smaller.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return { key: null, error: `${opts.label} must be a PNG, JPEG, or WebP image.` };
  const key = `${prefix}/${crypto.randomUUID()}.${kind.ext}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: kind.type } });
  return { key };
}

export const uploadLogo = (file: FormDataEntryValue | null, listingId: number) =>
  uploadImage(file, `logos/${listingId}`, { maxBytes: MAX_LOGO_BYTES, label: 'Logo' });

/** Delete an R2 object, ignoring empty keys. */
export async function deleteMedia(key: string | null | undefined) {
  if (key) await env.MEDIA.delete(key);
}
