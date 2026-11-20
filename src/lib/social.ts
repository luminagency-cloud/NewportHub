/** Pure social-link helpers (no runtime imports), unit-tested. */
import type { SocialLinks } from '../db/schema';

export type SocialNetwork = keyof SocialLinks;

/** Networks a listing can link to, in display order, with the hosts a link may point at. */
export const SOCIAL_NETWORKS: { key: SocialNetwork; label: string; hosts: string[] }[] = [
  { key: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.com'] },
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com'] },
  { key: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com'] },
  { key: 'x', label: 'X (Twitter)', hosts: ['x.com', 'twitter.com'] },
];

const onHost = (hostname: string, hosts: string[]) => hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));

/** A profile URL for one network, normalized to https, or an error. Empty input = no link. */
export function parseSocialUrl(network: SocialNetwork, raw: string): { url: string | null } | { error: string } {
  const net = SOCIAL_NETWORKS.find((n) => n.key === network)!;
  let v = raw.trim();
  if (!v) return { url: null };
  if (v.length > 300) return { error: `${net.label} link is too long.` };
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return { error: `${net.label} link is not a valid address.` };
  }
  const host = u.hostname.toLowerCase();
  if (!onHost(host, net.hosts)) return { error: `${net.label} link must be on ${net.hosts.join(' or ')}.` };
  // A bare network home page is not a profile.
  if (u.pathname === '/' || u.pathname === '') return { error: `${net.label} link must point at the business's page, not the site's home page.` };
  u.protocol = 'https:';
  u.hash = '';
  return { url: u.href.replace(/\/$/, '') };
}

/** Social fields from the admin listing form (`social_<network>`). Null when no link is set. */
export function parseSocialForm(form: FormData): { social: SocialLinks | null; errors: string[] } {
  const social: SocialLinks = {};
  const errors: string[] = [];
  for (const n of SOCIAL_NETWORKS) {
    const r = parseSocialUrl(n.key, String(form.get(`social_${n.key}`) ?? ''));
    if ('error' in r) errors.push(r.error);
    else if (r.url) social[n.key] = r.url;
  }
  return { social: Object.keys(social).length ? social : null, errors };
}

/** Set links in display order, for the listing page. */
export function socialEntries(social: SocialLinks | null | undefined): { key: SocialNetwork; label: string; url: string }[] {
  if (!social) return [];
  return SOCIAL_NETWORKS.flatMap((n) => (social[n.key] ? [{ key: n.key, label: n.label, url: social[n.key]! }] : []));
}

/**
 * Link to the business's Google Maps profile, from the Google place id saved at import.
 * Format per Google's Maps URLs docs (developers.google.com/maps/documentation/urls/get-started,
 * Search action): `query` is required, and `query_place_id` picks the exact place.
 * The importer falls back to Outscraper's `google_id` (`0x…:0x…`), which is not a place id: no link then.
 */
export function googleProfileUrl(placeId: string | null | undefined, name: string, address: string | null | undefined): string | null {
  if (!placeId || /^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(placeId)) return null;
  const query = [name, address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(placeId)}`;
}
