import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Opening hours, keyed by English day name. An empty array means closed that day. */
export type Hours = Partial<Record<Weekday, { open: string; close: string }[]>>;
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const TIERS = ['free', 'featured', 'premium'] as const;
export const STATUSES = ['pending', 'published', 'rejected'] as const;

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
};

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
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
    categoryId: integer('category_id').notNull().references(() => categories.id),
    townId: integer('town_id').notNull().references(() => towns.id),
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
    /** Google place id from the import source. Lets the seed script re-run without duplicates. */
    sourcePlaceId: text('source_place_id').unique(),
    ...timestamps,
  },
  (t) => [
    index('listings_status_tier_idx').on(t.status, t.tier),
    index('listings_category_idx').on(t.categoryId),
    index('listings_town_idx').on(t.townId),
  ],
);

export const bannerAds = sqliteTable(
  'banner_ads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    imageR2Key: text('image_r2_key').notNull(),
    linkUrl: text('link_url').notNull(),
    placement: text('placement').notNull(),
    startDate: text('start_date').notNull(), // ISO date, YYYY-MM-DD
    endDate: text('end_date').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('banner_ads_placement_idx').on(t.placement, t.active)],
);

export type Category = typeof categories.$inferSelect;
export type Town = typeof towns.$inferSelect;
export type Listing = typeof listings.$inferSelect;
