// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import clerk from '@clerk/astro';
import tailwindcss from '@tailwindcss/vite';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// "Site version" in the footer: package.json version plus the short commit, fixed at build time.
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
let commit = '';
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {}
const siteVersion = commit ? `${version} (${commit})` : version;

export default defineConfig({
  site: 'https://newporthub.com',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [clerk({ signInUrl: '/login', signUpUrl: '/signup' })],
  vite: { plugins: [tailwindcss()], define: { __SITE_VERSION__: JSON.stringify(siteVersion) } },
});
