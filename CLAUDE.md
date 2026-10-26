# NewportHub

Local business directory for Newport County, Rhode Island. Domain: newporthub.com.

**Unfinished work lives in Linear only**: project **NewportHub** (P-LA-12) in team Luminagency
(key `LA`), https://linear.app/luminagency/project/newporthub-be4355a41506. Current umbrella issue: LA-187.
New NewportHub issues go in that project. Read the relevant issues before starting work.
Do not keep a to-do list, roadmap, or "not built yet" notes in this repository. When work is done,
update or close the Linear issue; when new work is found, add it there. If Linear cannot be reached,
say so loudly and do not fall back to a file in the repo.

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
src/pages/[slug]/index.astro   /[parent]/, /[subcategory]/ (only if broken out, else 301 to parent), or /[town]/
src/pages/[slug]/[town].astro  /[category]/[town]/ (same redirect rule)
src/data/taxonomy.ts           starting category tree: parents, subcategories, Outscraper aliases, search terms, service towns
src/lib/category-rules.ts      pure: BREAKOUT_AT/COLLAPSE_BELOW, nextBrokenOut, alias matching, REFRESH_BREAKOUTS_SQL (unit-tested)
src/lib/categories.ts          refreshBreakouts()
src/components/CategorySelect.astro  parent → subcategory picker (owner form, admin approvals)
src/lib/category-icons.ts      category icon keys → Lucide SVGs (lucide-static); iconFor() falls back sub → parent → default
src/components/CategoryIcon.astro    inline category icon (home tiles, category headings, cards without a logo)
src/pages/admin/categories/    category tree; add, rename, move, merge, delete; import aliases; map unmapped import categories
src/pages/admin/towns/         towns: add, rename, merge, delete
src/lib/admin-taxonomy.ts      category/town/alias writes for those pages (retired slugs, merges)
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
src/lib/admin-listings.ts      admin search/create/edit/delete of any listing, slug redirects, change log
src/pages/admin/listings/      /admin/listings (search) and /admin/listings/<id|new> (every field, live at once)
src/lib/traffic.ts             listing views + outbound clicks: recordListingEvent, per-listing and site totals
src/lib/traffic-rules.ts       pure: beacon body parsing, day ranges (unit-tested)
src/pages/api/track.ts         POST beacon for outbound clicks
src/pages/admin/traffic/       site-wide traffic sent, by date range
src/lib/listing-form.ts        shared listing form validation + diffChanges()
src/lib/media.ts               logo upload to R2 (magic-byte check, PNG/JPEG/WebP, 1 MB)
src/lib/billing.ts             Stripe: checkout, portal, webhook verify + handlers, syncSubscription()
src/lib/plans.ts                 pure plan rules: tier keys, description length, what Basic hides (unit-tested)
src/lib/photos.ts                pure cover + extra photo changes (unit-tested)
src/lib/billing-tier.ts          pure subscription → tier rules, monthly and yearly prices (unit-tested)
src/pages/api/stripe/webhook.ts  Stripe webhook (signature-verified)
src/pages/account/listings/[id]/upgrade.ts  POST → Stripe Checkout (subscription mode)
src/pages/account/billing/index.ts          POST → Stripe customer portal
src/lib/ads.ts                 banner ads: pickAd (rotation), recordAdEvent (stats), admin save/delete
src/lib/ad-form.ts             pure ad helpers: form validation, adDay (NY time), isBot (unit-tested)
src/components/BannerAd.astro  renders one ad for a placement; counts the impression via waitUntil
src/pages/go/[id].ts           ad click: count, then 302 to the stored link
src/pages/admin/ads/           banner ad CRUD + stats
src/pages/sitemap.xml.ts       sitemap (only pages with published listings)
src/pages/robots.txt.ts        robots.txt
public/og-default.png          1200×630 default social card (regenerate with PIL if the brand changes)
scripts/seed-outscraper.ts     Outscraper import (.xlsx or .csv)
scripts/deploy.mjs             production deploy (npm run deploy): pull, npm ci, then deploy-steps.ts
scripts/wrangler.ts            runs wrangler through Node (works on Windows)
scripts/seed-categories.ts     writes src/data/taxonomy.ts to D1 (adds only)
scripts/outscraper-queries.ts  prints Outscraper queries (search terms × service towns)
```

## Conventions

- **Every commit bumps the version** in `package.json` (at least a patch:
  `npm version patch --no-git-tag-version`, which also updates `package-lock.json`). Minor for new
  features, major for breaking changes. Include the bump in the same commit as the change.
  If the version is higher than expected, the owner bumped it by hand: bump from there, no comment.

- **Bindings:** `import { env } from 'cloudflare:workers'`. `Astro.locals.runtime.env` no longer
  exists (removed in Astro 6). Run `npm run cf-typegen` after editing `wrangler.toml`.
- **Category and town slugs share one URL level.** A slug must not exist in both tables, and must
  not be a reserved route. Migration `0001_slug_guards.sql` enforces this with triggers; the
  reserved list there must match `RESERVED_SLUGS` in `src/lib/slug.ts`. Adding a new top-level
  route (e.g. `/pricing`) → add it to both places (new migration for the triggers).
- **Public queries only show `status = 'published'`.** Sort order is tier (featured, plus,
  basic) then name — keep the `tierRank` expression in `queries.ts` as the one place for this.
  Category pages are the exception: a Featured row (all Featured in that category, shuffled
  per view), then Plus and Featured cards, then Basic rows. See `categoryPageListings`.
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

## Categories

- Two levels. **Parents** (`parent_id` null) always have a page. **Subcategories** belong to one
  parent. A listing points at a subcategory, or at a parent ("Other <parent>", no label).
- A subcategory gets its own page (`broken_out = 1`) at `BREAKOUT_AT` (5) published listings and
  loses it below `COLLAPSE_BELOW` (3); in between it keeps its state. While not broken out, its URL
  301-redirects to the parent (and `/sub/town/` to `/parent/town/`), it is not in the sitemap, and
  its listings show on the parent page with the subcategory as the card label.
- **Run `refreshBreakouts()` after anything that publishes, unpublishes, or re-categorises a
  listing** (admin approvals do; the import runs the same SQL). Forgetting it leaves pages stale.
- Slugs are flat and share one namespace with towns (slug-clash triggers). Nested URLs would clash
  with `/category/town/`.
- **Imports file on the parent only** (a subcategory alias hit files on its parent); choosing a
  subcategory is up to the owner (a paid-plan feature, LA-190).
- **The owner picker only offers categories with published listings** (a parent counts its
  subcategories), plus the listing's current one. New categories come in through "suggest a new
  category"; the admin approval picker shows the full tree.
- Import mapping lives in `category_aliases` (lower-cased source name → category). Unknown source
  categories are not imported; they are recorded in `import_unmapped` and shown on
  `/admin/categories`.
- **Admin changes** (`/admin/categories`, `/admin/towns`) go live at once. A slug that stops being
  used (rename, merge, delete) goes into `retired_slugs` with its target category or town: the old
  URL (and `/old/town/`) 301s to the target's current slug; no target (a deleted parent or town) is
  a 404. Creating a category or town with a retired slug drops the retired row. Merge moves listings,
  aliases, open owner edits, and old URLs; delete needs no listings, no subcategories, and no open
  owner edit using it. Merges do not write `listing_changes` (that would stop imports refreshing them).
- The category seed and the importer never re-create a retired slug: aliases resolve to where the
  category went, and import rows for a merged service town go to the target town (deleted: skipped).
- **Icons:** `categories.icon` holds a key from `CATEGORY_ICONS` (picked in admin). A subcategory
  without one shows its parent's. The seed fills a parent's icon from `taxonomy.ts` only while it is
  null. New icons: add them to `CATEGORY_ICONS` (Lucide names).
- `src/data/taxonomy.ts` seeds a fresh database (`npm run seed:categories:*`, add-only). Its tests
  check that no alias maps twice and no slug clashes with a town or reserved route.

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
- **Admin edits** (`/admin/listings/<id>`) change every field at once, no review: status, plan, slug,
  owner (email or Clerk user id; the person must have an account), logo. Status `hidden` takes a
  listing off the site (the normal alternative to deleting); owners of hidden listings still edit
  through review. A slug change keeps the old URL as a 301 (`slug_redirects`). Admin edits and
  approved owner edits are logged in `listing_changes` (no FK, so the log outlives a deleted
  listing). Delete is refused while a Stripe subscription is live. A plan set by hand is
  overwritten by the next Stripe event if the listing has a subscription.

## Plans

Basic (free) / Plus ($19/mo or $190/yr) / Featured ($29/mo or $290/yr). Internal keys are
`basic` / `plus` / `featured`. They used to be `free` / `featured` / `premium`; migration
`0011_plan_tiers.sql` renames them in that order so the old middle plan (`featured`) becomes
`plus` before the old top plan (`premium`) takes the name `featured`.

- **Basic:** one cover photo, ~250-character public description, no hours, no social/menu/booking
  links, no extra photos, no events. Compact rows at the bottom of category pages. Imports are
  Basic and never store `working_hours`, even when the export has it.
- **Plus:** larger card in the main list, longer description, hours, links, 4 photos (cover + 3),
  events. No promotion.
- **Featured:** everything in Plus, plus a Featured businesses row on that business's own category
  pages (parent and subcategory, including the town filter). Every Featured listing in the category
  is in the row, order shuffled per view, horizontal scroll-snap (~3 / 2 / 1). They also appear in
  the Plus list below.
- Extra photos are a strip on the listing page only. The owner picks the cover.
- Downgrading hides paid-only content. It does not delete it.
- Choose a plan at `/account/listings/<id>/plan`: after an approved claim, after a new submission,
  and from My businesses (“Change plan”). Basic does not open Stripe. A live subscription goes to
  the customer portal. Locked owner fields link here with “Available on Plus”.
- Only Plus and Featured may post events (`canPostEvents`). Facebook shoutouts are posted by hand.
- The home page does not promote a plan. A home spotlight was removed because it would have
  promoted Plus, and a Featured-only home row is not part of these plans.

## Billing (Stripe)

- Plus and Featured are Stripe subscriptions, one per listing. Prices are never in code.
  `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_YEARLY`, `STRIPE_PRICE_FEATURED_MONTHLY`, and
  `STRIPE_PRICE_FEATURED_YEARLY` each hold a price id (`price_…`) or a product id (`prod_…`).
  A product id uses that product's active price for the same interval. A plan/interval with no id
  is not offered. The plan page shows $19/$190 and $29/$290; create Stripe prices at those amounts.
- **Choose plan** (published listings only) → Checkout in subscription mode for the selected
  interval. `metadata` and `subscription_data.metadata` carry `listing_id`, so every later
  subscription event names its listing. A listing that already has a live subscription goes to the
  portal instead. One Stripe customer per owner (reused across their listings), so one portal
  shows all plans.
- **Webhook** `/api/stripe/webhook` verifies the signature on the raw body. Handled:
  `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`. Every handler re-reads the subscription from Stripe and derives the tier
  (`tierForSubscription`): `active`/`trialing` on a configured price → that tier (Featured wins
  over Plus; month and year are the same tier), anything else → `basic`. So late, duplicate, or
  out-of-order events still end correct. `invoice.payment_failed`
  downgrades at once; a successful retry restores the tier through `customer.subscription.updated`.
- **Never delete or unpublish a listing for billing reasons.** Billing only changes `tier` and the
  `stripe_*` / `subscription_status` / `current_period_end` / `cancel_at_period_end` columns.
- Response codes: 400 bad signature, 500 handler error (Stripe retries), 200 applied or ignored,
  503 billing not configured.
- **Stripe dashboard setup (production):** products/prices for Featured and Premium (recurring);
  Customer portal enabled (Settings → Billing → Customer portal), allowing cancel and switching
  between the two plans; a webhook endpoint `https://newporthub.com/api/stripe/webhook` with the
  four events above — its signing secret is `STRIPE_WEBHOOK_SECRET`. Use the same API version as the
  SDK (`stripe` v23 → `2026-09-30.endive`); the code reads invoice → subscription from
  `invoice.parent.subscription_details` and period end from subscription items.

## Banner ads

- Placements (`AD_PLACEMENTS` in the schema): `home_top` (top of `/`) and `category_sidebar`
  (`/[category]/` and `/[category]/[town]/`; not town pages). Adding one: extend the enum,
  `PLACEMENT_LABELS`, and put `<BannerAd placement="…" />` where it shows.
- An ad shows when `active` and `start_date <= today <= end_date` (inclusive, America/New_York).
  Several eligible ads rotate by uniform random pick per request.
- Stats live in `ad_stats` (one row per ad per day, incremented with an upsert). Impressions count
  when an ad renders, clicks at `/go/<id>`; both run in `waitUntil` so they never delay the
  response. User agents matching `isBot` (crawlers, link previewers, headless browsers, curl) are
  not counted, so headless-browser tests show 0 impressions by design.
- `/go/<id>` only ever redirects to the stored `link_url` (http/https, validated on save), so it is
  not an open redirect. Clicks outside the ad's dates still redirect but are not counted.
- Images: PNG/JPEG/WebP, max 2 MB, R2 key `banners/<placement>/<uuid>.<ext>`; replacing or deleting
  an ad deletes the old object. `go` is a reserved slug (migration 0005).

## Traffic (views and clicks out)

- `listing_stats`: one row per listing per day (New York) per kind (`view`, `website`, `phone`,
  `email`, `directions`), incremented with an upsert, only for published listings.
- Views count when the listing page renders (`waitUntil`). Outbound links on the listing page carry
  `data-track="<kind>"` and point straight at the business; a click sends
  `navigator.sendBeacon('/api/track', '{"l":<id>,"k":"<kind>"}')`. The endpoint always answers 204.
- `isBot` user agents are not counted (headless browsers included: E2E tests need a normal UA).
  Counts are not deduplicated per visitor, and anyone can post the beacon, so treat numbers as
  indicative.
- Admin: per-listing totals for a date range and all time on `/admin/listings/<id>`; site totals
  and top listings on `/admin/traffic`.

## SEO

- `Base.astro` emits canonical, description (trimmed to ~160 chars), Open Graph, and Twitter card
  tags. `canonicalPath` drops query strings except `?page=N` for N > 1 (each page of a list is its
  own canonical). `ogImage` defaults to `/og-default.png`; listing pages pass their logo.
- `/sitemap.xml` lists home, categories, towns, category+town pairs, and listings — only those with
  published listings, so empty combinations and pending listings never appear. One file is fine up
  to 50,000 URLs; switch to a sitemap index before that.
- `/robots.txt` disallows account, admin, api, go, login, signup, and claim pages, and points to the
  sitemap. Private pages also send `noindex`.

### Testing billing locally with the Stripe CLI

The steps follow the Stripe CLI docs.

1. Test-mode keys in `.dev.vars`: `STRIPE_SECRET_KEY=sk_test_…`, and the four
   `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_YEARLY`, `STRIPE_PRICE_FEATURED_MONTHLY`,
   `STRIPE_PRICE_FEATURED_YEARLY` (test-mode price or product ids). Leave `STRIPE_API_BASE` unset.
2. `stripe login`, then `stripe listen --forward-to http://127.0.0.1:8787/api/stripe/webhook`.
   It prints a `whsec_…` secret: put it in `.dev.vars` as `STRIPE_WEBHOOK_SECRET`.
3. In another terminal: `npm run preview` (rebuilds and serves http://127.0.0.1:8787).
4. Sign in as the owner of a published listing → My listings → Upgrade. Pay with card
   `4242 4242 4242 4242`, any future expiry, any CVC. The `stripe listen` window should show
   `checkout.session.completed` → `[200]`, and the dashboard shows the new plan.
5. Manage billing → switch plan or cancel → `customer.subscription.updated` / `.deleted` → tier
   follows. Immediate cancel from the CLI: `stripe subscriptions cancel sub_…`.
6. Failed payment: in the portal set card `4000 0000 0000 0341` (attaches, then every charge fails)
   and let the next invoice be charged (a Stripe test clock advances time) → `invoice.payment_failed`
   → listing drops to free, dashboard says "Payment failed".
7. `stripe trigger <event>` makes its own unrelated objects: expect `200 … no listing found` in the
   logs. Useful to check plumbing, not tier changes.

Without a Stripe account, `STRIPE_API_BASE=http://127.0.0.1:12111` (honoured only with an
`sk_test_` key) points the SDK at a local mock API, and events can be signed by hand:
`Stripe-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" keyed with STRIPE_WEBHOOK_SECRET>`.

## Environment

| Variable | Where | Notes |
|---|---|---|
| `PUBLIC_CLERK_PUBLISHABLE_KEY` | `.dev.vars` locally; Worker var/secret in production | public |
| `CLERK_SECRET_KEY` | `.dev.vars`; `npx wrangler secret put CLERK_SECRET_KEY` | secret |
| `ADMIN_USER_IDS` | `.dev.vars`; `npx wrangler secret put ADMIN_USER_IDS` | Clerk user ids |
| `STRIPE_SECRET_KEY` | `.dev.vars`; `npx wrangler secret put STRIPE_SECRET_KEY` | secret; `sk_test_…` locally |
| `STRIPE_WEBHOOK_SECRET` | `.dev.vars` (from `stripe listen`); secret in production (from the dashboard endpoint) | secret |
| `STRIPE_PRICE_PLUS_MONTHLY`, `STRIPE_PRICE_PLUS_YEARLY` | `.dev.vars`; Worker var or secret | Plus price id (`price_…`) or product id (`prod_…`) |
| `STRIPE_PRICE_FEATURED_MONTHLY`, `STRIPE_PRICE_FEATURED_YEARLY` | `.dev.vars`; Worker var or secret | Featured price id or product id |
| `STRIPE_API_BASE` | `.dev.vars` only | test-only mock API base; ignored for live keys |

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
npm run seed:categories:local            # category tree + aliases from src/data/taxonomy.ts (run before importing)
npm run import:local -- path/to/export.xlsx   # import a real Outscraper export (.xlsx or .csv); import:remote for production
npm run outscraper:queries                # Outscraper query list (add -- --test for the 4-query test)

npm run dev                               # astro dev, http://localhost:4321 (uses local D1/R2)
npm run preview                           # astro build + wrangler dev, http://127.0.0.1:8787 (production-like)
npm test                                  # unit tests
npm run check                             # astro check + typecheck scripts

npx wrangler d1 execute DB --local --command "SELECT count(*) FROM listings"
npx wrangler r2 object put newporthub-media/logos/x.png --local --file ./x.png
```

## Deploy (Cloudflare Workers)

Production is the Worker `newporthub` with Custom Domain newporthub.com (`routes` in
`wrangler.toml`; deploy creates the DNS record and certificate). D1 `newporthub`, R2
`newporthub-media`, and the adapter's `SESSION` KV already exist. Deploy from a machine with
`npx wrangler login` done:

```sh
npm run deploy      # scripts/deploy.mjs: git pull, npm ci, then scripts/deploy-steps.ts
```

`scripts/deploy-steps.ts` stops at the first failing step: Cloudflare login check → `npm run check` →
`npm test` → remote migrations → remote category seed (add-only) → build → `wrangler deploy` →
smoke test (`/`, `/sitemap.xml`, `/robots.txt` must return 200). Checks and tests run before
anything remote changes. Stop `npm run dev`/`preview` first: on Windows `npm ci` cannot replace
files they hold open. Secrets are not part of it (`npx wrangler secret list` shows names).

- Migrations go first. Keep them additive (new tables/columns with constant defaults), so the code
  still running during the deploy keeps working. SQLite cannot add a column whose default is an
  expression such as `unixepoch()`.
- Rollback: `npx wrangler rollback` restores the previous Worker version (code only). Migrations are
  not rolled back, which is why they must be additive.
- Logs: `npx wrangler tail --format pretty`.
- Secret changes redeploy the Worker by themselves; no build needed.
- The importer refuses `data/sample-outscraper.csv` with `--remote` (fictional data).
- First-ever setup (done 2026-10-18, kept for rebuilding from scratch): `npx wrangler d1 create
  newporthub` → id into `wrangler.toml`; `npx wrangler r2 bucket create newporthub-media`.

`npm run preview` passes `--local-upstream 127.0.0.1:8787`: without it, wrangler dev rewrites the
request host to the custom domain in `routes`, and Clerk redirects signed-in requests to the real
newporthub.com.

## Seed import (Outscraper)

`scripts/seed-outscraper.ts` (`npm run import:local|import:remote -- <file>`) reads an Outscraper Google Maps export (.xlsx as downloaded, or .csv), writes `data/seed.sql`, and runs it
with `wrangler d1 execute`. Seed categories first. New listings: `status=published`, `tier=basic`,
unclaimed. Rows are matched on `place_id` (`source_place_id` column); re-running refreshes source
fields **only on unclaimed listings never edited in admin** (no `listing_changes` row), so owner and admin edits survive, and never touches tier, status, owner,
or Stripe fields. Skipped and reported: duplicates in the file, permanently closed, missing
name/city/state, and anything outside the service towns (`SERVICE_TOWNS`). Category: first alias hit
on `category`, then each `subtypes` entry, filed on that category's parent; no hit → row not imported, source category saved to
`import_unmapped`. **Hours are not imported** (Basic has no hours). Website is saved the way the form saves it (no trailing slash on a bare domain); `about` is used as
the description only when it is prose (Outscraper usually puts JSON there). Columns read: `name,
place_id|google_id, category|type, subtypes, city, us_state|state, full_address, phone, site,
email|email_1, description|about, latitude, longitude, business_status`. Logos are not imported.

Outscraper settings: Google Maps data only, no enrichments (emails, contacts, social, phone
validation, reviews, photos). Queries: `npm run outscraper:queries` (search term × town).

`data/sample-outscraper.csv` is fictional test data (names end in "(SAMPLE)", 555 phone numbers,
example.com sites). Do not deploy it.
