import type { AstroGlobal, APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { clerkClient } from '@clerk/astro/server';

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

/**
 * The Clerk user for an admin-entered owner: a user id (user_…) or an email address. Null when the
 * field is empty; an error when no such user exists (the owner must have signed up first).
 */
export async function resolveOwner(
  ctx: Parameters<typeof clerkClient>[0],
  raw: string,
): Promise<{ id: string | null; email: string | null } | { error: string }> {
  if (!raw) return { id: null, email: null };
  try {
    const users = clerkClient(ctx).users;
    if (raw.startsWith('user_')) {
      const u = await users.getUser(raw);
      return { id: u.id, email: u.primaryEmailAddress?.emailAddress ?? null };
    }
    const { data } = await users.getUserList({ emailAddress: [raw.toLowerCase()], limit: 2 });
    if (!data[0]) return { error: `No NewportHub account uses ${raw}. The owner needs to sign up first.` };
    return { id: data[0].id, email: data[0].primaryEmailAddress?.emailAddress ?? raw };
  } catch {
    return { error: `Could not look up the owner “${raw}” in Clerk.` };
  }
}

/** Primary email for a Clerk user id, or null if it cannot be looked up. */
export async function userEmail(ctx: Parameters<typeof clerkClient>[0], userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    return (await clerkClient(ctx).users.getUser(userId)).primaryEmailAddress?.emailAddress ?? null;
  } catch {
    return null;
  }
}
