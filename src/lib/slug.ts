/** Route names that /[slug]/ must never shadow. Keep in sync with the latest slug-guard migration (0005_reserve_go_slug.sql). */
export const RESERVED_SLUGS = new Set([
  'listing', 'search', 'media', 'api', 'admin', 'account', 'login', 'logout', 'signup', 'dashboard',
  'claim', 'pricing', 'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', '_astro', '_image', 'go',
]);

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Why `slug` cannot be a category or town URL, or null if it can. Clashes with existing categories
 * and towns are checked against the database (and enforced by the slug-guard triggers).
 */
export function placeSlugProblem(slug: string): string | null {
  if (!slug) return 'The URL name is empty.';
  if (slug.length > 80) return 'The URL name is longer than 80 characters.';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'The URL name may use lower-case letters, digits, and single hyphens only.';
  if (RESERVED_SLUGS.has(slug)) return `“${slug}” is a reserved address on the site.`;
  return null;
}
