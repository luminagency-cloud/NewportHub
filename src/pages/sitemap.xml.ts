import type { APIRoute } from 'astro';
import { sitemapEntries } from '../lib/queries';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Sitemap of category, town, category+town, and listing pages that have published listings.
 * A single file holds up to 50,000 URLs; split into a sitemap index before the directory gets near that.
 */
export const GET: APIRoute = async ({ site }) => {
  const base = site!.origin;
  const urls = (await sitemapEntries())
    .map(({ path, lastmod }) => `  <url><loc>${esc(base + path)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}</url>`)
    .join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
};
