import type { AstroGlobal, APIContext } from 'astro';
import { env } from 'cloudflare:workers';

type Ctx = Pick<AstroGlobal | APIContext, 'locals'>;

/** Clerk user ids allowed into /admin, from the comma-separated ADMIN_USER_IDS env var. */
export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const ids = String(env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

export interface SessionUser {
  id: string;
  /** Primary email, or the first verified one. */
  email: string;
  verifiedEmails: string[];
}

/** The signed-in user with their verified email addresses, or null. */
export async function sessionUser(ctx: Ctx): Promise<SessionUser | null> {
  const { userId } = ctx.locals.auth();
  if (!userId) return null;
  const user = await ctx.locals.currentUser();
  if (!user) return null;
  const verifiedEmails = user.emailAddresses
    .filter((e) => e.verification?.status === 'verified')
    .map((e) => e.emailAddress.toLowerCase());
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
  return { id: userId, email: (primary ?? verifiedEmails[0] ?? '').toLowerCase(), verifiedEmails };
}
