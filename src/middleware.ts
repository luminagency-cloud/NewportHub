import type { APIContext, MiddlewareNext } from 'astro';
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { clerkMiddleware } from '@clerk/astro/server';
import { isAdmin } from './lib/auth';

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
const isClaim = (path: string) => /^\/listing\/[^/]+\/claim\/?$/.test(path);
/** Pages that cannot work without Clerk. Everything else is public and must keep working. */
const needsAuth = (path: string) =>
  ['/admin', '/account', '/login', '/signup'].some((p) => under(path, p)) || isClaim(path);

const clerk = clerkMiddleware((auth, context, next) => {
  const path = context.url.pathname;
  const { userId, redirectToSignIn } = auth();

  if (under(path, '/admin')) {
    // Not found for everyone else, so the admin area is not advertised.
    if (!isAdmin(userId)) return new Response(null, { status: 404 });
  } else if (under(path, '/account') || isClaim(path)) {
    if (!userId) return redirectToSignIn({ returnBackUrl: context.url.href });
  }
  return next();
});

const clerkConfigured = () => {
  const e = env as { PUBLIC_CLERK_PUBLISHABLE_KEY?: string; CLERK_SECRET_KEY?: string };
  return !!e.PUBLIC_CLERK_PUBLISHABLE_KEY && !!e.CLERK_SECRET_KEY;
};

/**
 * Serve the request as signed out, without Clerk. Public pages render normally (header shows
 * "sign in"); pages that need auth answer 503 instead of crashing the whole site.
 */
function withoutClerk(context: APIContext, next: MiddlewareNext) {
  if (needsAuth(context.url.pathname)) {
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Sign-in unavailable | NewportHub</title>' +
        '<p style="font-family:system-ui;max-width:32rem;margin:4rem auto">Sign-in is temporarily unavailable. ' +
        'Please try again later. <a href="/">Back to NewportHub</a></p>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '300' } },
    );
  }
  const signedOut = { userId: null, sessionId: null, has: () => false, redirectToSignIn: () => new Response(null, { status: 503 }) };
  context.locals.auth = (() => signedOut) as unknown as App.Locals['auth'];
  context.locals.currentUser = async () => null;
  return next();
}

let warnedMissingKeys = false;

export const onRequest = defineMiddleware(async (context, next) => {
  if (!clerkConfigured()) {
    if (!warnedMissingKeys) {
      warnedMissingKeys = true; // once per isolate, not per request
      console.error('Clerk keys missing (PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY): serving public pages without auth');
    }
    return withoutClerk(context, next);
  }
  // Fall back only if Clerk fails before the page runs; an error from the page itself is rethrown.
  let pageStarted = false;
  const trackedNext: MiddlewareNext = (...args) => {
    pageStarted = true;
    return next(...args);
  };
  try {
    return (await clerk(context, trackedNext)) as Response;
  } catch (err) {
    if (pageStarted) throw err;
    console.error('Clerk failed; serving public pages without auth', err);
    return withoutClerk(context, next);
  }
});
