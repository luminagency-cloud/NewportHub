# NewportHub

Local business directory for Newport County, Rhode Island. How the app is put together, including
deploy, imports, and billing, is in [CLAUDE.md](CLAUDE.md).

## Plans

Basic is free. Plus is $19/month or $190/year. Featured is $29/month or $290/year. Owners pick a
plan at `/account/listings/<id>/plan`.

Stripe price ids are configuration, not code. Create the four prices in the Stripe Dashboard and
set them before paid checkout will work. Copy [`.env.example`](.env.example) to `.dev.vars` locally
(or set the same names as Worker variables in production):

- `STRIPE_PRICE_PLUS_MONTHLY`
- `STRIPE_PRICE_PLUS_YEARLY`
- `STRIPE_PRICE_FEATURED_MONTHLY`
- `STRIPE_PRICE_FEATURED_YEARLY`

Each value is a `price_…` id or a `prod_…` id. A product id uses that product's active price for
the matching interval. Leave a variable empty to hide that option.
