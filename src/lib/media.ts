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

/**
 * Store an uploaded logo in R2. Returns the new key, null when no file was chosen, or an error message.
 * Keys are unique per upload so a pending logo never overwrites the live one.
 */
export async function uploadLogo(file: FormDataEntryValue | null, listingId: number): Promise<{ key: string | null; error?: string }> {
  if (!(file instanceof File) || file.size === 0) return { key: null };
  if (file.size > MAX_LOGO_BYTES) return { key: null, error: 'Logo must be 1 MB or smaller.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return { key: null, error: 'Logo must be a PNG, JPEG, or WebP image.' };
  const key = `logos/${listingId}/${crypto.randomUUID()}.${kind.ext}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: kind.type } });
  return { key };
}

/** Delete an R2 object, ignoring empty keys. */
export async function deleteMedia(key: string | null | undefined) {
  if (key) await env.MEDIA.delete(key);
}
