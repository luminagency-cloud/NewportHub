import { and, asc, count, eq, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { categories, listings, retiredSlugs, towns, type Category } from '../db/schema';
import { categoryLink } from './category-rules';
import { db } from './db';

export const PAGE_SIZE = 24;

/** premium, then featured, then free. */
const tierRank = sql<number>`CASE ${listings.tier} WHEN 'premium' THEN 0 WHEN 'featured' THEN 1 ELSE 2 END`;

/** A listing's category's parent (null for listings filed directly under a parent). */
const parentCat = alias(categories, 'parent_cat');

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
  categoryBrokenOut: categories.brokenOut,
  parentName: parentCat.name,
  parentSlug: parentCat.slug,
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
  /** The listing's own category (a subcategory, or a parent for "general" listings). */
  categoryName: string;
  categorySlug: string;
  categoryBrokenOut: boolean;
  parentName: string | null;
  parentSlug: string | null;
  townName: string;
  townSlug: string;
};

/** Label shown on a card ("Pizza") and the page it links to (the parent until the sub breaks out). */
export function cardCategory(l: ListingCard) {
  return {
    label: l.categoryName,
    link: categoryLink({ slug: l.categorySlug, name: l.categoryName, brokenOut: l.categoryBrokenOut, parentSlug: l.parentSlug, parentName: l.parentName }),
  };
}

/** A category filter. A parent includes its subcategories. */
export type CategoryFilter = { id: number; isParent: boolean };
export const filterFor = (c: Pick<Category, 'id' | 'parentId'>): CategoryFilter => ({ id: c.id, isParent: c.parentId === null });

const categoryCondition = (f: CategoryFilter) =>
  f.isParent ? or(eq(listings.categoryId, f.id), eq(categories.parentId, f.id)) : eq(listings.categoryId, f.id);

export interface SearchParams {
  q?: string;
  category?: CategoryFilter;
  townId?: number;
  page?: number;
}

/** Published listings matching the filters. Paid tiers sort first, then by name. */
export async function searchListings({ q, category, townId, page = 1 }: SearchParams) {
  const filters: (SQL | undefined)[] = [eq(listings.status, 'published')];
  if (category) filters.push(categoryCondition(category));
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
        sql`${parentCat.name} LIKE ${pattern} ESCAPE '\\'`,
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
      .leftJoin(parentCat, eq(categories.parentId, parentCat.id))
      .innerJoin(towns, eq(listings.townId, towns.id))
      .where(where)
      .orderBy(tierRank, asc(listings.name))
      .limit(PAGE_SIZE)
      .offset(offset),
    db()
      .select({ n: count() })
      .from(listings)
      .innerJoin(categories, eq(listings.categoryId, categories.id))
      .leftJoin(parentCat, eq(categories.parentId, parentCat.id))
      .where(where),
  ]);
  return { rows: rows as ListingCard[], total: totals[0]?.n ?? 0 };
}

export interface TreeNode {
  id: number;
  slug: string;
  name: string;
  /** Published listings filed directly in this category. */
  own: number;
}
export interface TreeParent extends TreeNode {
  /** Published listings in the parent and all its subcategories. */
  total: number;
  subs: (TreeNode & { brokenOut: boolean })[];
}

/** All categories as parent → subcategories, with published counts. Parents sorted by name. */
export async function categoryTree(): Promise<TreeParent[]> {
  const rows = await db()
    .select({ id: categories.id, slug: categories.slug, name: categories.name, parentId: categories.parentId, brokenOut: categories.brokenOut, own: count(listings.id) })
    .from(categories)
    .leftJoin(listings, and(eq(listings.categoryId, categories.id), eq(listings.status, 'published')))
    .groupBy(categories.id)
    .orderBy(asc(categories.name));
  const parents = new Map<number, TreeParent>();
  for (const r of rows) if (r.parentId === null) parents.set(r.id, { id: r.id, slug: r.slug, name: r.name, own: r.own, total: r.own, subs: [] });
  for (const r of rows) {
    const p = r.parentId === null ? undefined : parents.get(r.parentId);
    if (!p) continue;
    p.subs.push({ id: r.id, slug: r.slug, name: r.name, own: r.own, brokenOut: r.brokenOut });
    p.total += r.own;
  }
  return [...parents.values()];
}

/** Ids of parents that have published listings in a town (for the town page's category links). */
export async function parentIdsInTown(townId: number): Promise<Set<number>> {
  const rows = await db()
    .select({ pid: sql<number>`coalesce(${categories.parentId}, ${categories.id})` })
    .from(listings)
    .innerJoin(categories, eq(listings.categoryId, categories.id))
    .where(and(eq(listings.status, 'published'), eq(listings.townId, townId)))
    .groupBy(sql`1`);
  return new Set(rows.map((r) => r.pid));
}

export async function allTowns() {
  return db().select().from(towns).orderBy(asc(towns.name));
}

/** A category with its parent (null for a parent). */
export async function getCategory(slug: string) {
  return (
    await db()
      .select({ category: categories, parent: parentCat })
      .from(categories)
      .leftJoin(parentCat, eq(categories.parentId, parentCat.id))
      .where(eq(categories.slug, slug))
      .limit(1)
  )[0];
}

/**
 * Where an old category or town slug (renamed, merged, or deleted in admin) points now: the
 * current slug of its target category or town. Both null: retired with nowhere to go (404).
 */
export async function retiredTarget(slug: string) {
  return (
    await db()
      .select({ category: categories.slug, town: towns.slug })
      .from(retiredSlugs)
      .leftJoin(categories, eq(retiredSlugs.categoryId, categories.id))
      .leftJoin(towns, eq(retiredSlugs.townId, towns.id))
      .where(eq(retiredSlugs.slug, slug))
      .limit(1)
  )[0];
}

export async function getTown(slug: string) {
  return (await db().select().from(towns).where(eq(towns.slug, slug)).limit(1))[0];
}

export async function getPublishedListing(slug: string) {
  return (
    await db()
      .select({ listing: listings, category: categories, parent: parentCat, town: towns })
      .from(listings)
      .innerJoin(categories, eq(listings.categoryId, categories.id))
      .leftJoin(parentCat, eq(categories.parentId, parentCat.id))
      .innerJoin(towns, eq(listings.townId, towns.id))
      .where(and(eq(listings.slug, slug), eq(listings.status, 'published')))
      .limit(1)
  )[0];
}

/**
 * Every indexable URL path with its last-modified time: home, parents, broken-out subcategories,
 * towns, those category × town pairs, and listings. Only pages that have published listings.
 */
export async function sitemapEntries(): Promise<{ path: string; lastmod: Date | null }[]> {
  const rows = await db()
    .select({
      slug: listings.slug,
      lastmod: listings.updatedAt,
      catSlug: categories.slug,
      catBrokenOut: categories.brokenOut,
      parentSlug: parentCat.slug,
      townSlug: towns.slug,
    })
    .from(listings)
    .innerJoin(categories, eq(listings.categoryId, categories.id))
    .leftJoin(parentCat, eq(categories.parentId, parentCat.id))
    .innerJoin(towns, eq(listings.townId, towns.id))
    .where(eq(listings.status, 'published'));

  const pages = new Map<string, Date>();
  const touch = (path: string, d: Date) => {
    const cur = pages.get(path);
    if (!cur || cur < d) pages.set(path, d);
  };
  for (const r of rows) {
    const parent = r.parentSlug ?? r.catSlug;
    touch('/', r.lastmod);
    touch(`/${parent}/`, r.lastmod);
    touch(`/${r.townSlug}/`, r.lastmod);
    touch(`/${parent}/${r.townSlug}/`, r.lastmod);
    if (r.parentSlug && r.catBrokenOut) {
      touch(`/${r.catSlug}/`, r.lastmod);
      touch(`/${r.catSlug}/${r.townSlug}/`, r.lastmod);
    }
    touch(`/listing/${r.slug}`, r.lastmod);
  }
  if (!pages.size) return [{ path: '/', lastmod: null }];
  // Home first, then category/town pages, then listings: sitemap order does not matter to crawlers,
  // but it keeps the file readable.
  return [...pages]
    .sort(([a], [b]) => (a === '/' ? -1 : b === '/' ? 1 : Number(a.startsWith('/listing/')) - Number(b.startsWith('/listing/')) || a.localeCompare(b)))
    .map(([path, lastmod]) => ({ path, lastmod }));
}
