import type { APIRoute } from 'astro';

/** Private, transactional, and redirect routes are kept out of crawlers; everything else is open. */
export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      'User-agent: *',
      'Disallow: /account',
      'Disallow: /admin',
      'Disallow: /api/',
      'Disallow: /go/',
      'Disallow: /login',
      'Disallow: /signup',
      'Disallow: /listing/*/claim',
      '',
      `Sitemap: ${new URL('/sitemap.xml', site).href}`,
      '',
    ].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } },
  );
