import { and, asc, count, desc, eq, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { categories, claims, listingChanges, listings, pendingEdits, slugRedirects, towns, type Listing } from '../db/schema';
import { refreshBreakouts } from './categories';
import { db } from './db';
import { fieldChanges, type AdminFields, type ListingFormValues } from './listing-form';
import { deleteMedia, uploadLogo } from './media';
import { slugify } from './slug';

export const ADMIN_PAGE_SIZE = 50;

const parentCat = alias(categories, 'parent_cat');

export interface AdminListingFilters {
  q?: string;
  status?: string;
  tier?: string;
  townId?: number;
  /** A parent id includes its subcategories. */
  categoryId?: number;
  owned?: 'yes' | 'no';
  page?: number;
}

/** Any listing, any status, newest change first. `q` matches name, phone, address, or slug. */
export async function searchAdminListings(f: AdminListingFilters) {
  const where: (SQL | undefined)[] = [];
  const term = f.q?.trim();
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    // Phone search ignores punctuation: "401 555" finds "(401) 555-0101".
    const digits = term.replace(/\D/g, '');
    where.push(
      or(
        sql`${listings.name} LIKE ${pattern} ESCAPE '\\'`,
        sql`${listings.address} LIKE ${pattern} ESCAPE '\\'`,
        sql`${listings.slug} LIKE ${pattern} ESCAPE '\\'`,
        digits.length >= 3
          ? sql`replace(replace(replace(replace(replace(replace(${listings.phone}, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', '') LIKE ${`%${digits}%`}`
          : undefined,
      ),
    );
  }
  if (f.status) where.push(eq(listings.status, f.status as Listing['status']));
  if (f.tier) where.push(eq(listings.tier, f.tier as Listing['tier']));
  if (f.townId) where.push(eq(listings.townId, f.townId));
  if (f.categoryId) where.push(or(eq(listings.categoryId, f.categoryId), eq(categories.parentId, f.categoryId)));
  if (f.owned === 'yes') where.push(isNotNull(listings.ownerUserId));
  if (f.owned === 'no') where.push(isNull(listings.ownerUserId));
  const filter = and(...where);
  const page = Math.max(1, f.page ?? 1);

  const [rows, totals] = await Promise.all([
    db()
      .select({
        id: listings.id, slug: listings.slug, name: listings.name, status: listings.status, tier: listings.tier,
        phone: listings.phone, ownerUserId: listings.ownerUserId, updatedAt: listings.updatedAt,
        categoryName: categories.name, parentName: parentCat.name, townName: towns.name,
        suggestedCategory: listings.suggestedCategory, suggestedTown: listings.suggestedTown,
      })
      .from(listings)
      .leftJoin(categories, eq(listings.categoryId, categories.id))
      .leftJoin(parentCat, eq(categories.parentId, parentCat.id))
      .leftJoin(towns, eq(listings.townId, towns.id))
      .where(filter)
      .orderBy(desc(listings.updatedAt), asc(listings.name))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db().select({ n: count() }).from(listings).leftJoin(categories, eq(listings.categoryId, categories.id)).where(filter),
  ]);
  return { rows, total: totals[0]?.n ?? 0 };
}

/** A listing with what the admin edit page shows next to it. */
export async function adminListingDetail(id: number) {
  const listing = (await db().select().from(listings).where(eq(listings.id, id)).limit(1))[0];
  if (!listing) return undefined;
  const [history, openEdit, openClaims, redirects] = await Promise.all([
    db().select().from(listingChanges).where(eq(listingChanges.listingId, id)).orderBy(desc(listingChanges.createdAt), desc(listingChanges.id)).limit(100),
    db().select({ id: pendingEdits.id }).from(pendingEdits).where(and(eq(pendingEdits.listingId, id), eq(pendingEdits.status, 'pending'))).limit(1),
    db().select({ n: count() }).from(claims).where(and(eq(claims.listingId, id), eq(claims.status, 'pending'))),
    db().select({ oldSlug: slugRedirects.oldSlug }).from(slugRedirects).where(eq(slugRedirects.listingId, id)),
  ]);
  return { listing, history, hasOpenEdit: openEdit.length > 0, openClaims: openClaims[0]?.n ?? 0, redirects: redirects.map((r) => r.oldSlug) };
}

/** The current slug of the listing an old slug redirects to, if any. */
export async function redirectedSlug(oldSlug: string): Promise<string | undefined> {
  const row = await db()
    .select({ slug: listings.slug })
    .from(slugRedirects)
    .innerJoin(listings, eq(slugRedirects.listingId, listings.id))
    .where(eq(slugRedirects.oldSlug, oldSlug))
    .limit(1);
  return row[0]?.slug;
}

async function slugTaken(slug: string, exceptId: number | null) {
  const [live, old] = await Promise.all([
    db().select({ id: listings.id }).from(listings).where(eq(listings.slug, slug)).limit(1),
    db().select({ id: slugRedirects.listingId }).from(slugRedirects).where(eq(slugRedirects.oldSlug, slug)).limit(1),
  ]);
  return (live[0] && live[0].id !== exceptId) || (old[0] && old[0].id !== exceptId);
}

async function freeSlug(base: string, exceptId: number | null) {
  const root = slugify(base) || 'listing';
  let slug = root;
  for (let n = 2; await slugTaken(slug, exceptId); n++) slug = `${root}-${n}`;
  return slug;
}

export interface AdminActor {
  id: string;
  email: string;
}

type SaveResult = { id: number; changed: number; logoError?: string } | { error: string };

/**
 * Create (id null) or update a listing with every field, live at once. Status, plan, slug, and owner
 * included. A slug change keeps the old URL as a 301. Every change is written to listing_changes.
 */
export async function saveAdminListing(
  id: number | null,
  v: ListingFormValues,
  a: AdminFields & { ownerUserId: string | null },
  logo: FormDataEntryValue | null,
  removeLogo: boolean,
  actor: AdminActor,
): Promise<SaveResult> {
  const current = id ? (await db().select().from(listings).where(eq(listings.id, id)).limit(1))[0] : undefined;
  if (id && !current) return { error: 'That listing no longer exists.' };

  const townName = v.townId ? (await db().select({ name: towns.name }).from(towns).where(eq(towns.id, v.townId)))[0]?.name : '';
  let slug = a.slug || current?.slug || '';
  if (!slug) slug = await freeSlug(`${v.name} ${townName ?? ''}`, null);
  else if (slug !== current?.slug && (await slugTaken(slug, id))) return { error: `The URL name “${slug}” is already used by another listing.` };

  const { suggestedCategory: _c, suggestedTown: _t, ...fields } = v;
  const next = {
    ...fields,
    slug,
    status: a.status,
    tier: a.tier,
    ownerUserId: a.ownerUserId,
    ...(current && a.ownerUserId !== current.ownerUserId ? { claimedAt: a.ownerUserId ? new Date() : null } : {}),
  };

  let listingId = id;
  if (!current) {
    const [row] = await db().insert(listings).values({ ...next, claimedAt: a.ownerUserId ? new Date() : null }).returning({ id: listings.id });
    listingId = row!.id;
  }
  const up = await uploadLogo(logo, listingId!);
  const logoR2Key = up.key ?? (removeLogo ? null : (current?.logoR2Key ?? null));

  const { claimedAt: _ca, ...logged } = next;
  const changes = fieldChanges(current ?? {}, { ...logged, logoR2Key });
  if (current && !Object.keys(changes).length) return { id: listingId!, changed: 0, logoError: up.error };

  const now = new Date();
  await db().batch([
    db().update(listings).set({ ...next, logoR2Key, updatedAt: now }).where(eq(listings.id, listingId!)),
    db().insert(listingChanges).values({ listingId: listingId!, userId: actor.id, userEmail: actor.email, action: current ? 'admin edit' : 'created by admin', changes }),
    ...(current && slug !== current.slug
      ? [
          // The old URL redirects here; a redirect for the new slug (from an earlier rename) is dropped.
          db().insert(slugRedirects).values({ oldSlug: current.slug, listingId: listingId! }).onConflictDoUpdate({ target: slugRedirects.oldSlug, set: { listingId: listingId! } }),
          db().delete(slugRedirects).where(eq(slugRedirects.oldSlug, slug)),
        ]
      : []),
  ]);
  if (current?.logoR2Key && current.logoR2Key !== logoR2Key) await deleteMedia(current.logoR2Key);
  await refreshBreakouts();
  return { id: listingId!, changed: Object.keys(changes).length, logoError: up.error };
}

/** Permanently delete a listing with its claims, open edits, redirects, and logo. The change log keeps a record. */
export async function deleteAdminListing(id: number, actor: AdminActor): Promise<{ ok: string } | { error: string }> {
  const listing = (await db().select().from(listings).where(eq(listings.id, id)).limit(1))[0];
  if (!listing) return { error: 'That listing no longer exists.' };
  if (listing.stripeSubscriptionId && (listing.subscriptionStatus === 'active' || listing.subscriptionStatus === 'trialing' || listing.subscriptionStatus === 'past_due'))
    return { error: 'This listing has a live Stripe subscription. Cancel it in Stripe first, or hide the listing instead.' };
  const editLogos = (await db().select({ changes: pendingEdits.changes }).from(pendingEdits).where(eq(pendingEdits.listingId, id)))
    .map((e) => e.changes.logoR2Key)
    .filter((k): k is string => !!k && k !== listing.logoR2Key);
  await db().batch([
    db().insert(listingChanges).values({
      listingId: id, userId: actor.id, userEmail: actor.email, action: 'deleted',
      changes: { name: [listing.name, null], slug: [listing.slug, null], ownerUserId: [listing.ownerUserId, null] },
    }),
    db().delete(claims).where(eq(claims.listingId, id)),
    db().delete(pendingEdits).where(eq(pendingEdits.listingId, id)),
    db().delete(listings).where(eq(listings.id, id)),
  ]);
  for (const key of [listing.logoR2Key, ...editLogos]) await deleteMedia(key);
  await refreshBreakouts();
  return { ok: `Deleted “${listing.name}”.` };
}
