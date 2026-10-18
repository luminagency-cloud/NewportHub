import { clerkMiddleware } from '@clerk/astro/server';
import { isAdmin } from './lib/auth';

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export const onRequest = clerkMiddleware((auth, context, next) => {
  const path = context.url.pathname;
  const { userId, redirectToSignIn } = auth();

  if (under(path, '/admin')) {
    // Not found for everyone else, so the admin area is not advertised.
    if (!isAdmin(userId)) return new Response(null, { status: 404 });
  } else if (under(path, '/account') || /^\/listing\/[^/]+\/claim\/?$/.test(path)) {
    if (!userId) return redirectToSignIn({ returnBackUrl: context.url.href });
  }
  return next();
});
