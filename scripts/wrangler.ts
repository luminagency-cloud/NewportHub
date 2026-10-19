/**
 * Run the project's wrangler CLI. Starts it through Node itself rather than `npx`: on Windows,
 * `npx` is a .cmd file that execFileSync cannot start without a shell.
 */
import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const bin = join(dirname(createRequire(import.meta.url).resolve('wrangler/package.json')), 'bin', 'wrangler.js');

export function wrangler(args: string[], options: ExecFileSyncOptions = { stdio: 'inherit' }) {
  return execFileSync(process.execPath, [bin, ...args], options);
}
