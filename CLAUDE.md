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
- **Clerk** (`@clerk/astro` v4) for auth. `src/middleware.ts` guards routes; Clerk's own UI at
  `/login` and `/signup` (hash routing, so no catch-all routes).
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
src/pages/listing/[slug]/index.astro  detail page + LocalBusiness JSON-LD + claim/edit link
src/pages/listing/[slug]/claim.astro  claim an unclaimed listing (signed in)
src/pages/search.astro         ?q=&category=&town=&page=
src/pages/account/             owner area: overview, new listing, edit own listing (signed in)
src/pages/admin/index.astro    moderation queues (ADMIN_USER_IDS only)
src/middleware.ts              Clerk; /account and /listing/*/claim need sign-in; /admin is 404 for non-admins.
                               Clerk keys missing or Clerk failing → public pages still render signed out; auth pages 503
src/lib/auth.ts                isAdmin(), sessionUser() (Clerk user + verified emails)
src/lib/verify.ts              email-domain claim verification
src/lib/owner.ts               owner writes: claims, submissions, edits
src/lib/admin.ts               moderation: approve/reject listings, claims, edits
src/lib/listing-form.ts        shared listing form validation + diffChanges()
src/lib/media.ts               logo upload to R2 (magic-byte check, PNG/JPEG/WebP, 1 MB)
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
- **Tests:** `npm test` runs `src/lib/*.test.ts` with Node's test runner (pure functions only).
- **D1 enforces foreign keys.** drizzle-kit's table-rebuild migrations emit `PRAGMA foreign_keys=OFF`,
  which does not work on D1; replace it with `PRAGMA defer_foreign_keys = on` and check the
  generated `INSERT … SELECT` (in 0002 it selected new columns from the old table). Test a rebuild
  migration on a seeded local DB before applying it remotely.
- Not built yet: payments (Stripe columns exist but are unused), banner ad display, email notifications.

## Owners and moderation

- **Claim** (`claims`): only published, unowned listings. If one of the user's *verified* Clerk
  emails is at the listing website's domain (or a parent of it), the claim is approved on creation
  and the user becomes owner. Free-mail domains and shared hosts (facebook.com, wixsite.com, …) never
  match — lists in `src/lib/verify.ts`. Otherwise the claim waits for an admin. Approving one claim
  rejects the other open claims on that listing. Ownership is set with a conditional update
  (`owner_user_id IS NULL`), so two claims cannot both win.
- **New listing:** `status = 'pending'`, owner = submitter. The submitter may suggest a new category
  or town (`suggested_category`/`suggested_town`, with `category_id`/`town_id` null); the admin
  maps it to an existing one or creates it on approval (slug-clash triggers still apply).
- **Edits:** unpublished listings (own pending/rejected submissions) change directly and go back to
  pending. Published listings never change from the owner form: the diff goes to `pending_edits`
  (one open edit per listing; saving again replaces it) and is applied on admin approval.
  Slug, tier, status, and ownership are never owner-editable.
- **Logos:** a new R2 key per upload (`logos/<listingId>/<uuid>.<ext>`), so a pending logo never
  replaces the live one. Replaced or rejected logo objects are deleted from R2.
- **Admin:** `ADMIN_USER_IDS` (comma-separated Clerk user ids). Non-admins get 404 on `/admin`.

## Environment

| Variable | Where | Notes |
|---|---|---|
| `PUBLIC_CLERK_PUBLISHABLE_KEY` | `.dev.vars` locally; Worker var/secret in production | public |
| `CLERK_SECRET_KEY` | `.dev.vars`; `npx wrangler secret put CLERK_SECRET_KEY` | secret |
| `ADMIN_USER_IDS` | `.dev.vars`; `npx wrangler secret put ADMIN_USER_IDS` | Clerk user ids |

The names are Astro's: `PUBLIC_CLERK_PUBLISHABLE_KEY`, not the `NEXT_PUBLIC_…` name the Clerk
dashboard shows for Next.js (a key under that name is ignored). See `.dev.vars.example`. `.dev.vars` is gitignored. Run `npm run cf-typegen` after adding variables.

**Testing auth locally:** Clerk sign-up shows a bot check (Cloudflare Turnstile) in headless
browsers. Do not try to get past it. Create test users with the Clerk Backend API instead
(`POST https://api.clerk.com/v1/users` with `email_address` and `skip_password_requirement` —
emails created this way are verified) and sign in with a sign-in token
(`POST /v1/sign_in_tokens`, then open `/login?__clerk_ticket=<token>`). Use a dev instance only.

## Commands

```sh
npm install
npm run db:migrate:local                  # create/upgrade local D1 (.wrangler/state)
npm run seed:local                        # import data/sample-outscraper.csv
npx tsx scripts/seed-outscraper.ts path/to/export.csv --local   # import a real Outscraper export

npm run dev                               # astro dev, http://localhost:4321 (uses local D1/R2)
npm run preview                           # astro build + wrangler dev, http://127.0.0.1:8787 (production-like)
npm test                                  # unit tests
npm run check                             # astro check + typecheck scripts

npx wrangler d1 execute DB --local --command "SELECT count(*) FROM listings"
npx wrangler r2 object put newporthub-media/logos/x.png --local --file ./x.png
```

Remote. The newporthub.com zone is on Cloudflare; `routes` in `wrangler.toml` attaches the Worker
as a Custom Domain on deploy. First deploy: `npx wrangler d1 create newporthub` and put the id
in `wrangler.toml`, `npx wrangler r2 bucket create newporthub-media`, then `npm run db:migrate:remote`,
`npm run seed:remote`, and `npm run build && npx wrangler deploy`.

`npm run preview` passes `--local-upstream 127.0.0.1:8787`: without it, wrangler dev rewrites the
request host to the custom domain in `routes`, and Clerk redirects signed-in requests to the real
newporthub.com.

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
