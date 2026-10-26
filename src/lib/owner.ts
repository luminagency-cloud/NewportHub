import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { claims, listings, pendingEdits, towns, type Listing, type ListingChanges } from '../db/schema';
import type { SessionUser } from './auth';
import { db } from './db';
import { categoryTree } from './queries';
import { diffChanges, type ListingFormValues } from './listing-form';
import { applyPhotoForm, photoFormInput } from './listing-photos';
import { deleteMedia, uploadLogo } from './media';
import { photoKeySet, unusedPhotoKeys, type PhotoSet } from './photos';
import { isPaid, restrictPaidFields, type PaidContent } from './plans';
import { slugify } from './slug';
import { matchingEmail } from './verify';

const emptyPaid = (): PaidContent => ({ description: null, hours: null, socialUrl: null, menuUrl: null, bookingUrl: null });

const paidOf = (l: Pick<Listing, 'description' | 'hours' | 'socialUrl' | 'menuUrl' | 'bookingUrl'>): PaidContent => ({
  description: l.description,
  hours: l.hours,
  socialUrl: l.socialUrl,
  menuUrl: l.menuUrl,
  bookingUrl: l.bookingUrl,
});

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
      .select({
        id: listings.id, slug: listings.slug, name: listings.name, status: listings.status, tier: listings.tier,
        stripeCustomerId: listings.stripeCustomerId, stripeSubscriptionId: listings.stripeSubscriptionId,
        subscriptionStatus: listings.subscriptionStatus, currentPeriodEnd: listings.currentPeriodEnd,
        cancelAtPeriodEnd: listings.cancelAtPeriodEnd,
      })
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

/** A brand-new listing from an owner. It stays pending (not public) until an admin approves it. New listings start on Basic. */
export async function submitListing(user: SessionUser, v: ListingFormValues, logo: FormDataEntryValue | null) {
  const safe = restrictPaidFields('basic', v, emptyPaid());
  const townName = safe.suggestedTown ?? (safe.townId ? (await db().select({ name: towns.name }).from(towns).where(eq(towns.id, safe.townId)))[0]?.name : '') ?? '';
  const [row] = await db()
    .insert(listings)
    .values({
      ...safe,
      slug: await uniqueSlug(`${safe.name} ${townName}`),
      status: 'pending',
      tier: 'basic',
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
 * directly and go (back) to pending. Published (and admin-hidden) listings never change here: the edit is stored in
 * pending_edits, replacing any earlier unreviewed edit, and goes live only when an admin approves it.
 */
export async function saveOwnerEdit(
  user: SessionUser,
  listing: Listing,
  v: ListingFormValues,
  form: FormData,
): Promise<{ result: 'updated' | 'queued' | 'unchanged'; logoError?: string }> {
  const safe = restrictPaidFields(listing.tier, v, paidOf(listing));
  const direct = listing.status === 'pending' || listing.status === 'rejected';
  const existing = direct ? undefined : await openEdit(listing.id);
  const working: PhotoSet = direct
    ? { cover: listing.logoR2Key, extras: listing.photos ?? [] }
    : {
        cover: existing && 'logoR2Key' in existing.changes ? (existing.changes.logoR2Key ?? null) : listing.logoR2Key,
        extras: existing && 'photos' in existing.changes ? (existing.changes.photos ?? []) : (listing.photos ?? []),
      };
  const applied = await applyPhotoForm(listing.id, working, photoFormInput(form, isPaid(listing.tier)));
  const photos = applied.photos;
  const photoValue = photos.extras.length ? photos.extras : null;

  if (direct) {
    await db()
      .update(listings)
      .set({ ...safe, logoR2Key: photos.cover, photos: photoValue, status: 'pending', updatedAt: new Date() })
      .where(eq(listings.id, listing.id));
    if (!applied.error) {
      for (const key of unusedPhotoKeys(photoKeySet(listing.logoR2Key, listing.photos), photoKeySet(photos.cover, photos.extras))) {
        await deleteMedia(key);
      }
    }
    return { result: 'updated', logoError: applied.error };
  }

  const { suggestedCategory: _c, suggestedTown: _t, ...fields } = safe;
  const next: ListingChanges = { ...fields };
  if (!applied.error) {
    if (photos.cover !== listing.logoR2Key) next.logoR2Key = photos.cover;
    if (JSON.stringify(photoValue) !== JSON.stringify(listing.photos ?? null)) next.photos = photoValue;
    const live = photoKeySet(listing.logoR2Key, listing.photos);
    const after = photoKeySet(photos.cover, photos.extras);
    for (const key of unusedPhotoKeys(photoKeySet(working.cover, working.extras), after)) {
      if (!live.has(key)) await deleteMedia(key);
    }
  } else if (existing) {
    if ('logoR2Key' in existing.changes) next.logoR2Key = existing.changes.logoR2Key;
    if ('photos' in existing.changes) next.photos = existing.changes.photos;
  }
  const changes = diffChanges(listing, next);

  if (!Object.keys(changes).length) {
    if (existing) await db().delete(pendingEdits).where(eq(pendingEdits.id, existing.id));
    return { result: 'unchanged', logoError: applied.error };
  }
  if (existing) {
    await db().update(pendingEdits).set({ changes, userEmail: user.email, updatedAt: new Date() }).where(eq(pendingEdits.id, existing.id));
  } else {
    await db().insert(pendingEdits).values({ listingId: listing.id, userId: user.id, userEmail: user.email, changes });
  }
  return { result: 'queued', logoError: applied.error };
}

/**
 * Lookups the listing form needs. Only categories with published listings are offered (a parent
 * counts its subcategories), plus the listing's current category so an edit keeps it. New categories
 * come in through "suggest a new category" and the admin.
 */
export async function formOptions(currentCategoryId?: number | null) {
  const [tree, ts] = await Promise.all([
    categoryTree(),
    db().select({ id: towns.id, name: towns.name, state: towns.state }).from(towns).orderBy(towns.name),
  ]);
  const offered = (c: { id: number; own: number }, n: number) => n > 0 || c.id === currentCategoryId;
  const categories = tree
    .map((p) => ({ ...p, subs: p.subs.filter((s) => offered(s, s.own)) }))
    .filter((p) => offered(p, p.total) || p.subs.length > 0);
  const categoryIds = new Set(categories.flatMap((p) => [p.id, ...p.subs.map((s) => s.id)]));
  return { categories, towns: ts, categoryIds, townIds: new Set(ts.map((t) => t.id)) };
}
