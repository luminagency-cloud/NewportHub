import type { APIRoute } from 'astro';

/** Older upgrade links land on the plan page. Checkout itself is posted there. */
export const GET: APIRoute = (ctx) => ctx.redirect(`/account/listings/${ctx.params.id}/plan`, 303);
export const POST: APIRoute = GET;
