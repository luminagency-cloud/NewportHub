import type { APIRoute } from 'astro';
import { billingEnabled, handleEvent, verifyEvent } from '../../../lib/billing';

/**
 * Stripe webhook. Stripe retries on any non-2xx, so: 400 for a bad signature (never valid),
 * 500 when applying the event fails (worth a retry), 200 once applied or deliberately ignored.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!billingEnabled()) return new Response('Billing not configured', { status: 503 });
  const body = await request.text();
  let event;
  try {
    event = await verifyEvent(body, request.headers.get('stripe-signature'));
  } catch (err) {
    console.warn('Stripe webhook rejected:', (err as Error).message);
    return new Response('Invalid signature', { status: 400 });
  }
  try {
    const note = await handleEvent(event);
    console.log(`Stripe ${event.type} ${event.id}: ${note}`);
    return new Response(note, { status: 200 });
  } catch (err) {
    console.error(`Stripe ${event.type} ${event.id} failed`, err);
    return new Response('Handler error', { status: 500 });
  }
};
