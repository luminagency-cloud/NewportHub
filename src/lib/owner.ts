import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { categories, claims, listings, pendingEdits, towns, type Listing, type ListingChanges } from '../db/schema';
import type { SessionUser } from './auth';
import { db } from './db';
import { diffChanges, type ListingFormValues } from './listing-form';
import { deleteMedia, uploadLogo } from './media';
import { slugify } from './slug';
import { matchingEmail } from './verify';

export async function getListing(id: number): Promise<Listing | undefined> {
  return (await db().select().from(listings).where(eq(listings.id, id)).limit(1))[0];
}

export async function getListingBySlug(slug: string): Promise<Listing | undefined> {
  return (await db().select().from(listings).where(eq(listings.slug, slug)).limit(1))[0];
}

/** Everything the account page shows for one user. */
export async function accountOverview(userId: string) {
  const [owned, myClaims, edits] = await Promise.all([
    db()
      .select({ id: listings.id, slug: listings.slug, name: listings.name, status: listings.status, tier: listings.tier })
      .from(listings)
      .where(eq(listings.ownerUserId, userId))
      .orderBy(listings.name),
    db()
      .select({ id: claims.id, status: claims.status, createdAt: claims.createdAt, listingName: listings.name, listingSlug: listings.slug })
      .from(claims)
      .innerJoin(listings, eq(claims.listingId, listings.id))
      .where(eq(claims.userId, userId))
      .orderBy(desc(claims.createdAt))
      .limit(20),
    db()
      .select({ listingId: pendingEdits.listingId, status: pendingEdits.status, reviewNote: pendingEdits.reviewNote, updatedAt: pendingEdits.updatedAt })
      .from(pendingEdits)
      .where(eq(pendingEdits.userId, userId))
      .orderBy(desc(pendingEdits.updatedAt))
      .limit(50),
  ]);
  // Latest edit per listing.
  const latestEdit = new Map<number, (typeof edits)[number]>();
  for (const e of edits) if (!latestEdit.has(e.listingId)) latestEdit.set(e.listingId, e);
  return { owned, claims: myClaims, latestEdit };
}

export async function hasPendingClaim(listingId: number, userId: string) {
  const row = await db()
    .select({ id: claims.id })
    .from(claims)
    .where(and(eq(claims.listingId, listingId), eq(claims.userId, userId), eq(claims.status, 'pending')))
    .limit(1);
  return row.length > 0;
}

/**
 * Claim an unclaimed published listing. A verified email at the listing's website domain makes the
 * user the owner at once; otherwise the claim waits for an admin.
 */
export async function createClaim(
  user: SessionUser,
  listing: Listing,
  message: string | null,
): Promise<{ result: 'approved' | 'pending' } | { error: string }> {
  if (listing.status !== 'published') return { error: 'This listing cannot be claimed.' };
  if (listing.ownerUserId) return { error: 'This listing already has an owner.' };
  if (await hasPendingClaim(listing.id, user.id)) return { error: 'You already have a pending claim on this listing.' };

  const matched = matchingEmail(user.verifiedEmails, listing.website);
  if (matched) {
    // Conditional update: only one claimant can win, even if two claims arrive together.
    const won = await db()
      .update(listings)
      .set({ ownerUserId: user.id, claimedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(listings.id, listing.id), isNull(listings.ownerUserId)))
      .returning({ id: listings.id });
    if (!won.length) return { error: 'This listing already has an owner.' };
    await db().batch([
      db().insert(claims).values({
        listingId: listing.id, userId: user.id, userEmail: matched, method: 'email_domain', status: 'approved',
        message, reviewedBy: 'auto:email_domain', reviewedAt: new Date(),
      }),
      db().update(claims).set({ status: 'rejected', reviewedBy: 'auto:owner_assigned', reviewedAt: new Date() })
        .where(and(eq(claims.listingId, listing.id), eq(claims.status, 'pending'))),
    ]);
    return { result: 'approved' };
  }

  await db().insert(claims).values({ listingId: listing.id, userId: user.id, userEmail: user.email, method: 'manual', message });
  return { result: 'pending' };
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || 'listing';
  const taken = new Set(
    (await db().select({ slug: listings.slug }).from(listings).where(sql`${listings.slug} = ${root} OR ${listings.slug} LIKE ${root + '-%'}`)).map((r) => r.slug),
  );
  let slug = root;
  for (let n = 2; taken.has(slug); n++) slug = `${root}-${n}`;
  return slug;
}

/** A brand-new listing from an owner. It stays pending (not public) until an admin approves it. */
export async function submitListing(user: SessionUser, v: ListingFormValues, logo: FormDataEntryValue | null) {
  const townName = v.suggestedTown ?? (v.townId ? (await db().select({ name: towns.name }).from(towns).where(eq(towns.id, v.townId)))[0]?.name : '') ?? '';
  const [row] = await db()
    .insert(listings)
    .values({
      ...v,
      slug: await uniqueSlug(`${v.name} ${townName}`),
      status: 'pending',
      tier: 'free',
      ownerUserId: user.id,
      claimedAt: new Date(),
    })
    .returning({ id: listings.id });
  const id = row!.id;
  const up = await uploadLogo(logo, id);
  if (up.key) await db().update(listings).set({ logoR2Key: up.key }).where(eq(listings.id, id));
  return { id, logoError: up.error };
}

export async function openEdit(listingId: number) {
  return (
    await db().select().from(pendingEdits).where(and(eq(pendingEdits.listingId, listingId), eq(pendingEdits.status, 'pending'))).limit(1)
  )[0];
}

/**
 * Save an owner's edit. Unpublished listings (their own pending or rejected submissions) change
 * directly and go (back) to pending. Published listings never change here: the edit is stored in
 * pending_edits, replacing any earlier unreviewed edit, and goes live only when an admin approves it.
 */
export async function saveOwnerEdit(
  user: SessionUser,
  listing: Listing,
  v: ListingFormValues,
  logo: FormDataEntryValue | null,
): Promise<{ result: 'updated' | 'queued' | 'unchanged'; logoError?: string }> {
  const up = await uploadLogo(logo, listing.id);

  if (listing.status !== 'published') {
    await db()
      .update(listings)
      .set({ ...v, ...(up.key ? { logoR2Key: up.key } : {}), status: 'pending', updatedAt: new Date() })
      .where(eq(listings.id, listing.id));
    if (up.key) await deleteMedia(listing.logoR2Key);
    return { result: 'updated', logoError: up.error };
  }

  const { suggestedCategory: _c, suggestedTown: _t, ...fields } = v;
  const next: ListingChanges = { ...fields, ...(up.key ? { logoR2Key: up.key } : {}) };
  const existing = await openEdit(listing.id);
  // A new upload replaces a logo that was only waiting in the earlier edit.
  if (up.key && existing?.changes.logoR2Key && existing.changes.logoR2Key !== listing.logoR2Key) {
    await deleteMedia(existing.changes.logoR2Key);
  } else if (!up.key && existing?.changes.logoR2Key) {
    next.logoR2Key = existing.changes.logoR2Key;
  }
  const changes = diffChanges(listing, next);

  if (!Object.keys(changes).length) {
    if (existing) await db().delete(pendingEdits).where(eq(pendingEdits.id, existing.id));
    return { result: 'unchanged', logoError: up.error };
  }
  if (existing) {
    await db().update(pendingEdits).set({ changes, userEmail: user.email, updatedAt: new Date() }).where(eq(pendingEdits.id, existing.id));
  } else {
    await db().insert(pendingEdits).values({ listingId: listing.id, userId: user.id, userEmail: user.email, changes });
  }
  return { result: 'queued', logoError: up.error };
}

/** Lookups the listing form needs. */
export async function formOptions() {
  const [cats, ts] = await Promise.all([
    db().select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.name),
    db().select({ id: towns.id, name: towns.name, state: towns.state }).from(towns).orderBy(towns.name),
  ]);
  return { categories: cats, towns: ts, categoryIds: new Set(cats.map((c) => c.id)), townIds: new Set(ts.map((t) => t.id)) };
}
