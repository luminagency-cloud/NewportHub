# NewportHub

Local business directory for Newport County, Rhode Island. How the app is put together, including
deploy, imports, and billing, is in [CLAUDE.md](CLAUDE.md).

## Plans

Basic is free. Plus is $15/month or $149/year. Featured is $39/month or $350/year. Owners pick a
plan at `/account/listings/<id>/plan`.

The live Stripe price ids are plain text `[vars]` in [`wrangler.toml`](wrangler.toml) (NewportHub
account `acct_1UVVEACQlLtUg0Tw`):

- `STRIPE_PRICE_PLUS_MONTHLY` — Plus, $15/month
- `STRIPE_PRICE_PLUS_YEARLY` — Plus, $149/year
- `STRIPE_PRICE_FEATURED_MONTHLY` — Featured, $39/month
- `STRIPE_PRICE_FEATURED_YEARLY` — Featured, $350/year

A value may be a `price_…` id or a `prod_…` id. A product id uses that product's active price for
the matching interval. Copy [`.env.example`](.env.example) to `.dev.vars` for local development;
those values override `wrangler.toml`. Leave a variable empty to hide that option. Use test-mode
price ids locally.

## Hosting and deployment

**Where it runs:** Cloudflare Workers. The Worker is `newporthub`, served at https://newporthub.com
through a Workers Custom Domain (`routes` in `wrangler.toml`; the deploy creates the DNS record and
certificate). Data lives in D1 (`newporthub`), media in R2 (`newporthub-media`), and sessions in
the adapter's `SESSION` KV namespace.

**Requirements:** Node.js 22 or newer (Astro requires `>=22.22.0`, and the migration test uses
`node:sqlite`). Run `npx wrangler login` once on the machine you deploy from.

**Deploy:**

```sh
npm run deploy
```

This runs `scripts/deploy.mjs` (git pull, `npm ci`), then `scripts/deploy-steps.ts`, which stops at
the first failure: Cloudflare login check → type check → unit tests → **remote D1 migrations** →
category seed (add-only) → build → `wrangler deploy` → smoke test. Checks and tests run before
anything remote changes. Migrations are applied by the deploy itself, before the new Worker goes
live, so keep them additive. `npx wrangler rollback` restores the previous Worker version (code
only; migrations are not rolled back). Full details are in [CLAUDE.md](CLAUDE.md#deploy-cloudflare-workers).

**Production secrets** (`npx wrangler secret put <NAME>`). Locally the same names go in
`.dev.vars` (copy [`.env.example`](.env.example)):

| Variable | Purpose |
|---|---|
| `PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (public) |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `ADMIN_USER_IDS` | Clerk user ids with admin access |
| `STRIPE_SECRET_KEY` | Stripe secret key for the NewportHub account (`acct_1UVVEACQlLtUg0Tw`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `https://newporthub.com/api/stripe/webhook` |

The four `STRIPE_PRICE_*` values are the `[vars]` in `wrangler.toml`, so they go out with the next
deploy. Paid checkout stays disabled for any plan/interval whose `STRIPE_PRICE_*` variable is empty,
and until `STRIPE_SECRET_KEY` is set.
