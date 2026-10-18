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
