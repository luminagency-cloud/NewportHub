/** Pure category rules (no runtime imports), shared by the app, the seed scripts, and tests. */

/**
 * Break-out thresholds, counted in published listings. A subcategory gets its own page at
 * BREAKOUT_AT and loses it only below COLLAPSE_BELOW, so a count hovering around the line
 * does not make the page appear and disappear (decided 2026-10-19, Linear LA-188).
 */
export const BREAKOUT_AT = 5;
export const COLLAPSE_BELOW = 3;

/** The broken-out state after a count change. Between the thresholds the current state is kept. */
export function nextBrokenOut(current: boolean, publishedCount: number): boolean {
  if (publishedCount >= BREAKOUT_AT) return true;
  if (publishedCount < COLLAPSE_BELOW) return false;
  return current;
}

/** Alias key for a source category name: lower-case, single spaces, "&" spelled "and". */
export function aliasKey(name: string): string {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

/**
 * Our category id for a source row: the main category first, then each subtype in order. The first
 * alias hit wins, except that a hit on a parent is narrowed to the first later subtype that maps to
 * one of that parent's subcategories ("Restaurant, Breakfast restaurant" → Breakfast & Brunch, but
 * "Bar, Seafood restaurant" stays in Bars). Returns null with the name to report when nothing maps.
 */
export function mapSourceCategory(
  candidates: (string | null | undefined)[],
  aliases: Map<string, number>,
  parentOf: Map<number, number | null> = new Map(),
): { categoryId: number } | { unmapped: string | null } {
  const names = candidates.filter((c): c is string => !!c && !!c.trim());
  const ids = names.map((n) => aliases.get(aliasKey(n)));
  const first = ids.findIndex((id) => id !== undefined);
  if (first === -1) return { unmapped: names[0]?.trim() ?? null };
  const id = ids[first]!;
  if (parentOf.get(id) === null) {
    const sub = ids.slice(first + 1).find((s) => s !== undefined && parentOf.get(s) === id);
    if (sub !== undefined) return { categoryId: sub };
  }
  return { categoryId: id };
}

/** The page a listing's category links to: the subcategory if broken out, otherwise its parent. */
export function categoryLink(c: { slug: string; name: string; brokenOut: boolean; parentSlug: string | null; parentName: string | null }) {
  if (!c.parentSlug || c.brokenOut) return { slug: c.slug, name: c.name };
  return { slug: c.parentSlug, name: c.parentName ?? c.name };
}

/**
 * One statement that applies nextBrokenOut() to every subcategory from live counts. Run it after
 * anything that publishes, unpublishes, or re-categorises listings (admin approvals, imports).
 */
export const REFRESH_BREAKOUTS_SQL = `UPDATE categories SET broken_out = CASE
  WHEN (SELECT count(*) FROM listings l WHERE l.category_id = categories.id AND l.status = 'published') >= ${BREAKOUT_AT} THEN 1
  WHEN (SELECT count(*) FROM listings l WHERE l.category_id = categories.id AND l.status = 'published') < ${COLLAPSE_BELOW} THEN 0
  ELSE broken_out END
WHERE parent_id IS NOT NULL`;
