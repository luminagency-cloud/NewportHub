/**
 * Google business attributes (accessibility, ownership, parking, …) as Outscraper exports them in
 * its `about` column: `{"Accessibility": {"Wheelchair accessible entrance": true}, "Other": {...}}`.
 * Pure (no runtime imports): the importer uses it too. Unit-tested.
 */
import type { ListingAttributes } from '../db/schema';

/** The `about` value as attributes, or null when it is not that JSON shape (or has no entries). */
export function parseAbout(raw: string | null | undefined): ListingAttributes | null {
  const text = raw?.trim();
  if (!text?.startsWith('{')) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const out: ListingAttributes = {};
  for (const [group, items] of Object.entries(data as Record<string, unknown>)) {
    if (!items || typeof items !== 'object' || Array.isArray(items)) continue;
    const kept: Record<string, boolean> = {};
    for (const [name, v] of Object.entries(items as Record<string, unknown>)) {
      if (typeof v === 'boolean' && name.trim()) kept[name.trim().slice(0, 100)] = v;
    }
    if (Object.keys(kept).length) out[group.trim().slice(0, 60)] = kept;
  }
  return Object.keys(out).length ? out : null;
}

/** Labels for the attributes that are true, as shown on the listing ("Identifies as women-owned" → "Women-owned"). */
export function attributeBadges(attrs: ListingAttributes | null | undefined): string[] {
  if (!attrs) return [];
  const seen = new Set<string>();
  for (const items of Object.values(attrs)) {
    for (const [name, on] of Object.entries(items)) {
      if (!on) continue;
      const label = name.replace(/^identifies as\s+/i, '');
      seen.add(label.charAt(0).toUpperCase() + label.slice(1));
    }
  }
  return [...seen];
}
