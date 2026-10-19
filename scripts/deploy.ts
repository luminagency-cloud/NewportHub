/**
 * Deploy to production in one go: checks, tests, remote migrations, category seed, build, deploy,
 * smoke test. Stops at the first failure, before anything remote changes if checks or tests fail.
 *
 *   npm run deploy        (package.json pulls and runs npm ci first)
 */
import { execFileSync } from 'node:child_process';
import { wrangler } from './wrangler';

const SITE = 'https://newporthub.com';

// Run npm through Node: on Windows, `npm` is a .cmd file that execFileSync cannot start directly.
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('Run this with `npm run deploy`.');
  process.exit(1);
}
const npm = (...args: string[]) => execFileSync(process.execPath, [npmCli, ...args], { stdio: 'inherit' });

function step(name: string, run: () => unknown) {
  console.log(`\n=== ${name}`);
  try {
    run();
  } catch {
    console.error(`\nStopped: "${name}" failed (output above). Nothing after it ran.`);
    process.exit(1);
  }
}

/** wrangler whoami --json exits 1 when logged out, with the JSON still on stdout. */
function whoami(): { loggedIn: boolean; email?: string; accounts?: { name: string }[] } {
  try {
    return JSON.parse(String(wrangler(['whoami', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })));
  } catch (e) {
    return JSON.parse(String((e as { stdout?: string }).stdout || '{"loggedIn":false}'));
  }
}

step('Cloudflare account', () => {
  const who = whoami();
  if (!who.loggedIn) {
    console.error('Not logged in to Cloudflare. Run `npx wrangler login`, then `npm run deploy` again.');
    process.exit(1);
  }
  console.log(`${who.email ?? '?'} (${who.accounts?.map((a) => a.name).join(', ') ?? '?'})`);
});
step('Type check', () => npm('run', 'check'));
step('Unit tests', () => npm('test'));
step('Database migrations (remote)', () => wrangler(['d1', 'migrations', 'apply', 'DB', '--remote']));
step('Category seed (remote, add-only)', () => npm('run', 'seed:categories:remote'));
step('Build', () => npm('run', 'build'));
step('Deploy', () => wrangler(['deploy']));

console.log('\n=== Smoke test');
let failed = false;
for (const path of ['/', '/sitemap.xml', '/robots.txt']) {
  const res = await fetch(SITE + path, { redirect: 'manual' });
  console.log(`${res.status}  ${SITE}${path}`);
  if (res.status !== 200) failed = true;
}
console.log(failed ? '\nDeployed, but a smoke-test page did not return 200. Check `npx wrangler tail`.' : '\nDeployed.');
process.exit(failed ? 1 : 0);
