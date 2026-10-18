import { and, asc, count, eq, or, sql, type SQL } from 'drizzle-orm';
import { categories, listings, towns } from '../db/schema';
import { db } from './db';

export const PAGE_SIZE = 24;

/** premium, then featured, then free. */
const tierRank = sql<number>`CASE ${listings.tier} WHEN 'premium' THEN 0 WHEN 'featured' THEN 1 ELSE 2 END`;

const cardFields = {
  slug: listings.slug,
  name: listings.name,
  address: listings.address,
  phone: listings.phone,
  description: listings.description,
  logoR2Key: listings.logoR2Key,
  tier: listings.tier,
  categoryName: categories.name,
  categorySlug: categories.slug,
  townName: towns.name,
  townSlug: towns.slug,
};

export type ListingCard = {
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  description: string | null;
  logoR2Key: string | null;
  tier: 'free' | 'featured' | 'premium';
  categoryName: string;
  categorySlug: string;
  townName: string;
  townSlug: string;
};

export interface SearchParams {
  q?: string;
  categoryId?: number;
  townId?: number;
  page?: number;
}

/** Published listings matching the filters. Paid tiers sort first, then by name. */
export async function searchListings({ q, categoryId, townId, page = 1 }: SearchParams) {
  const filters: (SQL | undefined)[] = [eq(listings.status, 'published')];
  if (categoryId) filters.push(eq(listings.categoryId, categoryId));
  if (townId) filters.push(eq(listings.townId, townId));
  const term = q?.trim();
  if (term) {
    // Escape LIKE wildcards so user input matches literally.
    const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(
      or(
        sql`${listings.name} LIKE ${pattern} ESCAPE '\\'`,
        sql`${listings.description} LIKE ${pattern} ESCAPE '\\'`,
        sql`${categories.name} LIKE ${pattern} ESCAPE '\\'`,
      ),
    );
  }
  const where = and(...filters);
  const offset = (Math.max(1, page) - 1) * PAGE_SIZE;

  const [rows, totals] = await Promise.all([
    db()
      .select(cardFields)
      .from(listings)
      .innerJoin(categories, eq(listings.categoryId, categories.id))
      .innerJoin(towns, eq(listings.townId, towns.id))
      .where(where)
      .orderBy(tierRank, asc(listings.name))
      .limit(PAGE_SIZE)
      .offset(offset),
    db()
      .select({ n: count() })
      .from(listings)
      .innerJoin(categories, eq(listings.categoryId, categories.id))
      .where(where),
  ]);
  return { rows: rows as ListingCard[], total: totals[0]?.n ?? 0 };
}

/** Categories with their published listing counts, for the home grid. */
export async function categoriesWithCounts() {
  return db()
    .select({ slug: categories.slug, name: categories.name, n: count(listings.id) })
    .from(categories)
    .leftJoin(listings, and(eq(listings.categoryId, categories.id), eq(listings.status, 'published')))
    .groupBy(categories.id)
    .orderBy(asc(categories.name));
}

export async function allCategories() {
  return db().select().from(categories).orderBy(asc(categories.name));
}

export async function allTowns() {
  return db().select().from(towns).orderBy(asc(towns.name));
}

export async function getCategory(slug: string) {
  return (await db().select().from(categories).where(eq(categories.slug, slug)).limit(1))[0];
}

export async function getTown(slug: string) {
  return (await db().select().from(towns).where(eq(towns.slug, slug)).limit(1))[0];
}

export async function getPublishedListing(slug: string) {
  return (
    await db()
      .select({ listing: listings, category: categories, town: towns })
      .from(listings)
      .innerJoin(categories, eq(listings.categoryId, categories.id))
      .innerJoin(towns, eq(listings.townId, towns.id))
      .where(and(eq(listings.slug, slug), eq(listings.status, 'published')))
      .limit(1)
  )[0];
}
