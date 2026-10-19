import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

/** Opening hours, keyed by English day name. An empty array means closed that day. */
export type Hours = Partial<Record<Weekday, { open: string; close: string }[]>>;
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const TIERS = ['free', 'featured', 'premium'] as const;
export const STATUSES = ['pending', 'published', 'rejected'] as const;
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const CLAIM_METHODS = ['email_domain', 'manual'] as const;

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
};

/**
 * Parents (parent_id null) always have a page. Subcategories get their own page only while
 * `broken_out` is set; see src/lib/category-rules.ts and refreshBreakouts().
 */
export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    parentId: integer('parent_id').references((): AnySQLiteColumn => categories.id),
    brokenOut: integer('broken_out', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('categories_parent_idx').on(t.parentId)],
);

/** Import mapping: a source category name (lower-cased, e.g. "sushi restaurant") → our category. */
export const categoryAliases = sqliteTable('category_aliases', {
  alias: text('alias').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
});

/** Source categories the importer could not map, for admin review. Rows with them were not imported. */
export const importUnmapped = sqliteTable('import_unmapped', {
  sourceCategory: text('source_category').primaryKey(),
  rows: integer('rows').notNull().default(0),
  example: text('example'),
  lastSeen: integer('last_seen', { mode: 'timestamp' }),
});

export const towns = sqliteTable('towns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  state: text('state').notNull(),
});

export const listings = sqliteTable(
  'listings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    // Null only on a pending owner submission that suggests a new category or town.
    // Approval sets both; public queries inner-join, so null rows never show.
    categoryId: integer('category_id').references(() => categories.id),
    townId: integer('town_id').references(() => towns.id),
    suggestedCategory: text('suggested_category'),
    suggestedTown: text('suggested_town'),
    address: text('address'),
    phone: text('phone'),
    website: text('website'),
    email: text('email'),
    description: text('description'),
    hours: text('hours', { mode: 'json' }).$type<Hours>(),
    lat: real('lat'),
    lng: real('lng'),
    logoR2Key: text('logo_r2_key'),
    tier: text('tier', { enum: TIERS }).notNull().default('free'),
    status: text('status', { enum: STATUSES }).notNull().default('pending'),
    ownerUserId: text('owner_user_id'),
    claimedAt: integer('claimed_at', { mode: 'timestamp' }),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    /** Stripe subscription status as of the last webhook (active, past_due, canceled, …). */
    subscriptionStatus: text('subscription_status'),
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),
    cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
    /** Google place id from the import source. Lets the seed script re-run without duplicates. */
    sourcePlaceId: text('source_place_id').unique(),
    ...timestamps,
  },
  (t) => [
    index('listings_status_tier_idx').on(t.status, t.tier),
    index('listings_category_idx').on(t.categoryId),
    index('listings_town_idx').on(t.townId),
    index('listings_stripe_subscription_idx').on(t.stripeSubscriptionId),
    index('listings_stripe_customer_idx').on(t.stripeCustomerId),
  ],
);

export const AD_PLACEMENTS = ['home_top', 'category_sidebar'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export const bannerAds = sqliteTable(
  'banner_ads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Admin-facing label, e.g. advertiser + campaign. */
    name: text('name').notNull().default(''),
    /** Image alt text, read out by screen readers. */
    altText: text('alt_text').notNull().default(''),
    imageR2Key: text('image_r2_key').notNull(),
    linkUrl: text('link_url').notNull(),
    placement: text('placement', { enum: AD_PLACEMENTS }).notNull(),
    startDate: text('start_date').notNull(), // ISO date, YYYY-MM-DD, inclusive, America/New_York
    endDate: text('end_date').notNull(), // inclusive
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('banner_ads_placement_idx').on(t.placement, t.active)],
);

/** Daily impression and click counts per ad: one row per ad per day, incremented in place. */
export const adStats = sqliteTable(
  'ad_stats',
  {
    adId: integer('ad_id').notNull().references(() => bannerAds.id, { onDelete: 'cascade' }),
    day: text('day').notNull(), // YYYY-MM-DD, America/New_York
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.adId, t.day] })],
);

/** Ownership claims on existing listings. An email-domain match is approved on creation. */
export const claims = sqliteTable(
  'claims',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    listingId: integer('listing_id').notNull().references(() => listings.id),
    userId: text('user_id').notNull(),
    userEmail: text('user_email').notNull(),
    method: text('method', { enum: CLAIM_METHODS }).notNull(),
    status: text('status', { enum: REVIEW_STATUSES }).notNull().default('pending'),
    message: text('message'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => [
    index('claims_status_idx').on(t.status),
    uniqueIndex('claims_one_pending_per_user').on(t.listingId, t.userId).where(sql`status = 'pending'`),
  ],
);

/** Fields an owner may change. Slug, tier, status, and ownership are not editable. */
export type ListingChanges = Partial<
  Pick<
    typeof listings.$inferInsert,
    'name' | 'categoryId' | 'townId' | 'address' | 'phone' | 'website' | 'email' | 'description' | 'hours' | 'logoR2Key'
  >
>;

/** Owner edits to published listings, held for moderation. One open edit per listing. */
export const pendingEdits = sqliteTable(
  'pending_edits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    listingId: integer('listing_id').notNull().references(() => listings.id),
    userId: text('user_id').notNull(),
    userEmail: text('user_email').notNull(),
    changes: text('changes', { mode: 'json' }).$type<ListingChanges>().notNull(),
    status: text('status', { enum: REVIEW_STATUSES }).notNull().default('pending'),
    reviewNote: text('review_note'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => [
    index('pending_edits_status_idx').on(t.status),
    uniqueIndex('pending_edits_one_open_per_listing').on(t.listingId).where(sql`status = 'pending'`),
  ],
);

export type Category = typeof categories.$inferSelect;
export type Town = typeof towns.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type PendingEdit = typeof pendingEdits.$inferSelect;
export type BannerAd = typeof bannerAds.$inferSelect;
