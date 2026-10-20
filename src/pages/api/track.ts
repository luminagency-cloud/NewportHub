// Outbound-click beacon from listing pages: body {"l": listingId, "k": kind}. Always 204; the
// count is written after the response (waitUntil). Views are counted by the page itself.
import type { APIRoute } from 'astro';
import { parseTrackBody } from '../../lib/traffic-rules';
import { recordListingEvent } from '../../lib/traffic';

export const POST: APIRoute = async ({ request, locals }) => {
  const event = parseTrackBody(await request.text());
  if (event) {
    const work = recordListingEvent(event.listingId, event.kind, request.headers.get('user-agent')).catch((err) => console.error('Track failed', err));
    if (locals.cfContext) locals.cfContext.waitUntil(work);
    else await work;
  }
  return new Response(null, { status: 204 });
};
