import type { APIRoute } from 'astro';
import { getAd, isLive, recordAdEvent } from '../../lib/ads';

/**
 * Ad click: count it, then redirect to the advertiser. Only stored ad URLs are ever redirected to
 * (never a URL from the request), so this is not an open redirect. Clicks on ads outside their
 * dates still redirect but are not counted.
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const id = Number(params.id);
  const ad = Number.isInteger(id) && id > 0 ? await getAd(id) : undefined;
  if (!ad) return new Response(null, { status: 404 });
  if (isLive(ad)) {
    locals.cfContext?.waitUntil(recordAdEvent(ad.id, 'click', request.headers.get('user-agent')).catch((err) => console.error('Ad click failed', err)));
  }
  return new Response(null, {
    status: 302,
    headers: { location: ad.linkUrl, 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
};
