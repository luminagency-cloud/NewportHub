# NewportHub

Local business directory for Newport County, Rhode Island. Domain: newporthub.com.

## Stack

- **Astro 7** with `@astrojs/cloudflare` (v14). `output: 'server'`; a page opts into static output
  with `export const prerender = true` (only `404.astro` today — data pages read D1 per request so
  approvals show up without a rebuild).
- **Cloudflare Workers** runtime. Bindings in `wrangler.toml`:
  - `DB` — D1 (SQLite), accessed through **Drizzle ORM**.
  - `MEDIA` — R2 bucket for logos and banner images, served by `src/pages/media/[...key].ts`.
  - `SESSION` — KV, added automatically by the adapter (Astro sessions). Unused so far; the
    adapter provisions it on first deploy.
- **Tailwind CSS 4** via `@tailwindcss/vite` (`src/styles/global.css`).
- **TypeScript 6, strict** (`astro/tsconfigs/strict` + `noUncheckedIndexedAccess`). Not TS 7:
  `astro check` refuses TS 7.0, and Astro's TS 7 path (`@astrojs/ts-content-mapper`) needs TS 7.1+.

## Layout

```
src/db/schema.ts          Drizzle schema — single source of truth for tables
drizzle/migrations/       SQL migrations, applied by wrangler (not drizzle-kit)
src/lib/db.ts             db() — Drizzle client bound to env.DB
src/lib/queries.ts        all read queries; pages do not build SQL themselves
src/lib/hours.ts          hours JSON → display rows and schema.org openingHoursSpecification
src/lib/slug.ts           slugify() and RESERVED_SLUGS
src/pages/[slug]/index.astro   /[category]/ OR /[town]/ (category is checked first)
src/pages/[slug]/[town].astro  /[category]/[town]/
src/pages/listing/[slug].astro detail page + LocalBusiness JSON-LD
src/pages/search.astro         ?q=&category=&town=&page=
scripts/seed-outscraper.ts     CSV import
```

## Conventions

- **Bindings:** `import { env } from 'cloudflare:workers'`. `Astro.locals.runtime.env` no longer
  exists (removed in Astro 6). Run `npm run cf-typegen` after editing `wrangler.toml`.
- **Category and town slugs share one URL level.** A slug must not exist in both tables, and must
  not be a reserved route. Migration `0001_slug_guards.sql` enforces this with triggers; the
  reserved list there must match `RESERVED_SLUGS` in `src/lib/slug.ts`. Adding a new top-level
  route (e.g. `/pricing`) → add it to both places (new migration for the triggers).
- **Public queries only show `status = 'published'`.** Sort order is tier (premium, featured,
  free) then name — keep the `tierRank` expression in `queries.ts` as the one place for this.
- **Not found:** `return new Response(null, { status: 404 })` from the page frontmatter. Do not use
  `Astro.rewrite('/404')` — the 404 page is prerendered and the rewrite fails at runtime.
- **Hours** are stored as JSON: `{ "Monday": [{ "open": "09:00", "close": "17:00" }], "Sunday": [] }`.
  Empty array = closed. Missing day = unknown. 24-hour = `00:00`–`23:59`.
- **Timestamps** are unix seconds (`integer` with `mode: 'timestamp'`).
- **Schema changes:** edit `src/db/schema.ts` → `npm run db:generate` → review the SQL →
  `npm run db:migrate:local`. Hand-written SQL (triggers etc.): `npx drizzle-kit generate --custom --name <name>`.
- Scripts run in Node and have their own `scripts/tsconfig.json`; app code must not import `node:*`.
- Not built yet: auth, claiming, payments (Stripe columns exist but are unused), banner ad display.

## Commands

```sh
npm install
npm run db:migrate:local                  # create/upgrade local D1 (.wrangler/state)
npm run seed:local                        # import data/sample-outscraper.csv
npx tsx scripts/seed-outscraper.ts path/to/export.csv --local   # import a real Outscraper export

npm run dev                               # astro dev, http://localhost:4321 (uses local D1/R2)
npm run preview                           # astro build + wrangler dev, http://localhost:8787 (production-like)
npm run check                             # astro check + typecheck scripts

npx wrangler d1 execute DB --local --command "SELECT count(*) FROM listings"
npx wrangler r2 object put newporthub-media/logos/x.png --local --file ./x.png
```

Remote. The newporthub.com zone is on Cloudflare; `routes` in `wrangler.toml` attaches the Worker
as a Custom Domain on deploy. First deploy: `npx wrangler d1 create newporthub` and put the id
in `wrangler.toml`, `npx wrangler r2 bucket create newporthub-media`, then `npm run db:migrate:remote`,
`npm run seed:remote`, and `npm run build && npx wrangler deploy`.

## Seed import (Outscraper)

`scripts/seed-outscraper.ts` reads an Outscraper Google Maps CSV, writes `data/seed.sql`, and runs it
with `wrangler d1 execute`. New listings: `status=published`, `tier=free`, unclaimed. Rows are
matched on `place_id` (`source_place_id` column), so re-running refreshes source fields and keeps
tier, status, owner, and Stripe fields. Permanently closed rows and rows without name, category,
city, or state are skipped and listed. Columns read: `name, place_id|google_id, category|type|subtypes,
city, us_state|state, full_address, phone, site, email|email_1, description|about, working_hours,
latitude, longitude, business_status`. Logos are not imported (Outscraper's `logo` is a Google URL;
copy to R2 separately if wanted).

`data/sample-outscraper.csv` is fictional test data (names end in "(SAMPLE)", 555 phone numbers,
example.com sites). Do not deploy it.
