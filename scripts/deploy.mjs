// `npm run deploy`: pull, reinstall, then run scripts/deploy-steps.ts.
// Plain JS on purpose: it runs before `npm ci`, which replaces node_modules (tsx included).
import { execFileSync } from 'node:child_process';

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('Run this with `npm run deploy`.');
  process.exit(1);
}

// npm 12 hands a user-level allow-scripts setting down to child installs, which then refuse to run
// (EALLOWSCRIPTS, https://github.com/npm/cli/issues/9912). The child install does not need it.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_config_allow[-_]scripts$/i.test(k)));
const run = (file, args) => execFileSync(file, args, { stdio: 'inherit', env });

try {
  run('git', ['pull', '--ff-only']);
  run(process.execPath, [npmCli, 'ci']);
  run(process.execPath, [npmCli, 'exec', '--', 'tsx', 'scripts/deploy-steps.ts']);
} catch {
  process.exit(1);
}
