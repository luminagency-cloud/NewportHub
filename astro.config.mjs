// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import clerk from '@clerk/astro';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://newporthub.com',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [clerk({ signInUrl: '/login', signUpUrl: '/signup' })],
  vite: { plugins: [tailwindcss()] },
});
