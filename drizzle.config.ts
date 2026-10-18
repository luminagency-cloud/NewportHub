import { defineConfig } from 'drizzle-kit';

// drizzle-kit only generates SQL here. Wrangler applies it (see package.json db:* scripts).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
});
