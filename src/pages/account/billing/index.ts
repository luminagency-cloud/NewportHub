import type { APIRoute } from 'astro';
import { and, eq, isNotNull } from 'drizzle-orm';
import { listings } from '../../../db/schema';
import { billingEnabled, createPortal } from '../../../lib/billing';
import { db } from '../../../lib/db';

/** POST → Stripe customer portal for the signed-in owner's billing customer. */
export const POST: APIRoute = async (ctx) => {
  const { userId } = ctx.locals.auth();
  if (!userId) return ctx.redirect('/login', 303);
  if (!billingEnabled()) return ctx.redirect('/account?done=billing-unavailable', 303);
  const row = (
    await db()
      .select({ customer: listings.stripeCustomerId })
      .from(listings)
      .where(and(eq(listings.ownerUserId, userId), isNotNull(listings.stripeCustomerId)))
      .limit(1)
  )[0];
  if (!row?.customer) return ctx.redirect('/account?done=no-billing', 303);
  try {
    return ctx.redirect(await createPortal(row.customer, ctx.url.origin), 303);
  } catch (err) {
    console.error('Stripe portal failed', err);
    return ctx.redirect('/account?done=billing-error', 303);
  }
};
