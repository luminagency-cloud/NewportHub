/** Route names that /[slug]/ must never shadow. Keep in sync with drizzle/migrations/0001_slug_guards.sql. */
export const RESERVED_SLUGS = new Set([
  'listing', 'search', 'media', 'api', 'admin', 'account', 'login', 'logout', 'signup', 'dashboard',
  'claim', 'pricing', 'about', 'contact', 'privacy', 'terms', 'sitemap', 'robots', '_astro', '_image',
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
