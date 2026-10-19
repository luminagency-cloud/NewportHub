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
 * Our category id for a source row: the main category first, then each subtype in order.
 * Returns the first alias hit, or null with the name to report as unmapped.
 */
export function mapSourceCategory(
  candidates: (string | null | undefined)[],
  aliases: Map<string, number>,
): { categoryId: number } | { unmapped: string | null } {
  const names = candidates.filter((c): c is string => !!c && !!c.trim());
  for (const name of names) {
    const id = aliases.get(aliasKey(name));
    if (id) return { categoryId: id };
  }
  return { unmapped: names[0]?.trim() ?? null };
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
