import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { categories, claims, listingChanges, listings, pendingEdits, retiredSlugs, towns, type Listing, type ListingChanges } from '../db/schema';
import { refreshBreakouts } from './categories';
import { db } from './db';
import { fieldChanges } from './listing-form';
import { deleteMedia } from './media';
import { photoKeySet, unusedPhotoKeys } from './photos';
import { RESERVED_SLUGS, slugify } from './slug';

const photoSet = (l: Pick<Listing, 'logoR2Key' | 'photos'>) => photoKeySet(l.logoR2Key, l.photos);

/** Keys an edit introduced that are not on the live listing, so a rejection can delete them. */
function pendingOnlyKeys(listing: Listing, changes: ListingChanges): string[] {
  const live = photoSet(listing);
  const pending = new Set<string>();
  if ('logoR2Key' in changes && changes.logoR2Key) pending.add(changes.logoR2Key);
  if ('photos' in changes) for (const key of changes.photos ?? []) if (key) pending.add(key);
  return [...pending].filter((key) => !live.has(key));
}

/** The three moderation queues, oldest first. */
export async function moderationQueues() {
  const [newListings, openClaims, edits] = await Promise.all([
    db()
      .select({ listing: listings, categoryName: categories.name, townName: towns.name })
      .from(listings)
      .leftJoin(categories, eq(listings.categoryId, categories.id))
      .leftJoin(towns, eq(listings.townId, towns.id))
      .where(eq(listings.status, 'pending'))
      .orderBy(asc(listings.createdAt)),
    db()
      .select({ claim: claims, listingName: listings.name, listingSlug: listings.slug, website: listings.website, ownerUserId: listings.ownerUserId })
      .from(claims)
      .innerJoin(listings, eq(claims.listingId, listings.id))
      .where(eq(claims.status, 'pending'))
      .orderBy(asc(claims.createdAt)),
    db()
      .select({ edit: pendingEdits, listing: listings })
      .from(pendingEdits)
      .innerJoin(listings, eq(pendingEdits.listingId, listings.id))
      .where(eq(pendingEdits.status, 'pending'))
      .orderBy(asc(pendingEdits.createdAt)),
  ]);
  return { newListings, openClaims, edits };
}

export async function lookups() {
  const [cats, ts] = await Promise.all([
    db().select().from(categories).orderBy(categories.name),
    db().select().from(towns).orderBy(towns.name),
  ]);
  return { categories: cats, towns: ts };
}

type Result = { ok: string } | { error: string };

/**
 * Find a category by name, or create it as a subcategory of `parentId`. Creation fails on a slug
 * clash (DB trigger) or a reserved route. New subcategories start without their own page.
 */
async function ensureCategory(name: string, parentId: number | null): Promise<{ id: number } | { error: string }> {
  const slug = slugify(name);
  if (!slug || RESERVED_SLUGS.has(slug)) return { error: `"${name}" cannot be used as a category name.` };
  const found = await db().select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
  if (found[0]) return found[0];
  // A name the admin renamed or merged away maps to where it went.
  const retired = (await db().select({ id: retiredSlugs.categoryId }).from(retiredSlugs).where(eq(retiredSlugs.slug, slug)))[0];
  if (retired?.id) return { id: retired.id };
  const parent = parentId ? (await db().select({ id: categories.id, parentId: categories.parentId }).from(categories).where(eq(categories.id, parentId)))[0] : undefined;
  if (!parent || parent.parentId !== null) return { error: 'Choose the parent category for the new subcategory.' };
  try {
    const [, [row]] = await db().batch([
      db().delete(retiredSlugs).where(eq(retiredSlugs.slug, slug)),
      db().insert(categories).values({ slug, name, parentId: parent.id }).returning({ id: categories.id }),
    ]);
    return row!;
  } catch {
    return { error: `Category "${name}" clashes with a town of the same name. Pick another name.` };
  }
}

async function ensureTown(name: string, state: string): Promise<{ id: number } | { error: string }> {
  const slug = slugify(name);
  if (!slug || RESERVED_SLUGS.has(slug)) return { error: `"${name}" cannot be used as a town name.` };
  const found = await db().select({ id: towns.id }).from(towns).where(eq(towns.slug, slug));
  if (found[0]) return found[0];
  const retired = (await db().select({ id: retiredSlugs.townId }).from(retiredSlugs).where(eq(retiredSlugs.slug, slug)))[0];
  if (retired?.id) return { id: retired.id };
  if (!/^[A-Z]{2}$/.test(state)) return { error: 'Town state must be a two-letter code, e.g. RI.' };
  try {
    const [, [row]] = await db().batch([
      db().delete(retiredSlugs).where(eq(retiredSlugs.slug, slug)),
      db().insert(towns).values({ slug, name, state }).returning({ id: towns.id }),
    ]);
    return row!;
  } catch {
    return { error: `Town "${name}" clashes with a category of the same name. Pick another name.` };
  }
}

/**
 * Publish a pending listing. `category`/`town` is an existing id, or "new" to create one from the
 * (admin-editable) name sent alongside.
 */
export async function approveListing(id: number, form: FormData): Promise<Result> {
  const listing = (await db().select().from(listings).where(and(eq(listings.id, id), eq(listings.status, 'pending'))))[0];
  if (!listing) return { error: 'Listing is not pending.' };

  let categoryId = Number(form.get('categoryId')) || null;
  if (form.get('categoryId') === 'new') {
    const r = await ensureCategory(String(form.get('newCategory') ?? '').trim(), Number(form.get('newCategoryParent')) || null);
    if ('error' in r) return r;
    categoryId = r.id;
  }
  let townId = Number(form.get('townId')) || null;
  if (form.get('townId') === 'new') {
    const r = await ensureTown(String(form.get('newTown') ?? '').trim(), String(form.get('newTownState') ?? '').trim().toUpperCase());
    if ('error' in r) return r;
    townId = r.id;
  }
  if (!categoryId || !townId) return { error: 'Choose a category and a town before approving.' };

  await db()
    .update(listings)
    .set({ status: 'published', categoryId, townId, suggestedCategory: null, suggestedTown: null, updatedAt: new Date() })
    .where(eq(listings.id, id));
  await refreshBreakouts();
  return { ok: `Published “${listing.name}”.` };
}

export async function rejectListing(id: number): Promise<Result> {
  const done = await db()
    .update(listings)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(and(eq(listings.id, id), eq(listings.status, 'pending')))
    .returning({ name: listings.name });
  return done[0] ? { ok: `Rejected “${done[0].name}”.` } : { error: 'Listing is not pending.' };
}

export async function approveClaim(claimId: number, adminId: string): Promise<Result> {
  const claim = (await db().select().from(claims).where(and(eq(claims.id, claimId), eq(claims.status, 'pending'))))[0];
  if (!claim) return { error: 'Claim is not pending.' };
  const won = await db()
    .update(listings)
    .set({ ownerUserId: claim.userId, claimedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(listings.id, claim.listingId), isNull(listings.ownerUserId)))
    .returning({ name: listings.name });
  if (!won[0]) return { error: 'That listing already has an owner. Reject this claim, or remove the owner first.' };
  const now = new Date();
  await db().batch([
    db().update(claims).set({ status: 'approved', reviewedBy: adminId, reviewedAt: now }).where(eq(claims.id, claimId)),
    // One owner per listing: the other open claims on it are closed.
    db().update(claims).set({ status: 'rejected', reviewedBy: adminId, reviewedAt: now })
      .where(and(eq(claims.listingId, claim.listingId), eq(claims.status, 'pending'), ne(claims.id, claimId))),
  ]);
  return { ok: `${claim.userEmail} now owns “${won[0].name}”.` };
}

export async function rejectClaim(claimId: number, adminId: string): Promise<Result> {
  const done = await db()
    .update(claims)
    .set({ status: 'rejected', reviewedBy: adminId, reviewedAt: new Date() })
    .where(and(eq(claims.id, claimId), eq(claims.status, 'pending')))
    .returning({ email: claims.userEmail });
  return done[0] ? { ok: `Rejected claim by ${done[0].email}.` } : { error: 'Claim is not pending.' };
}

export async function approveEdit(editId: number, adminId: string): Promise<Result> {
  const row = (
    await db()
      .select({ edit: pendingEdits, listing: listings })
      .from(pendingEdits)
      .innerJoin(listings, eq(pendingEdits.listingId, listings.id))
      .where(and(eq(pendingEdits.id, editId), eq(pendingEdits.status, 'pending')))
  )[0];
  if (!row) return { error: 'Edit is not pending.' };
  const changes: ListingChanges = { ...row.edit.changes };
  // Category or town could have been removed since the edit was made.
  if (changes.categoryId && !(await db().select({ id: categories.id }).from(categories).where(eq(categories.id, changes.categoryId)))[0])
    return { error: 'The category in this edit no longer exists. Reject it.' };
  if (changes.townId && !(await db().select({ id: towns.id }).from(towns).where(eq(towns.id, changes.townId)))[0])
    return { error: 'The town in this edit no longer exists. Reject it.' };

  const now = new Date();
  await db().batch([
    db().update(listings).set({ ...changes, updatedAt: now }).where(eq(listings.id, row.listing.id)),
    db().update(pendingEdits).set({ status: 'approved', reviewedBy: adminId, reviewedAt: now }).where(eq(pendingEdits.id, editId)),
    db().insert(listingChanges).values({
      listingId: row.listing.id, userId: row.edit.userId, userEmail: row.edit.userEmail, action: `owner edit, approved by ${adminId}`,
      changes: fieldChanges(row.listing, changes),
    }),
  ]);
  const mergedCover = 'logoR2Key' in changes ? (changes.logoR2Key ?? null) : row.listing.logoR2Key;
  const mergedExtras = 'photos' in changes ? (changes.photos ?? []) : (row.listing.photos ?? []);
  for (const key of unusedPhotoKeys(photoSet(row.listing), photoKeySet(mergedCover, mergedExtras))) await deleteMedia(key);
  if (changes.categoryId) await refreshBreakouts();
  return { ok: `Applied edit to “${row.listing.name}”.` };
}

export async function rejectEdit(editId: number, adminId: string, note: string | null): Promise<Result> {
  const row = (
    await db()
      .select({ edit: pendingEdits, listing: listings })
      .from(pendingEdits)
      .innerJoin(listings, eq(pendingEdits.listingId, listings.id))
      .where(and(eq(pendingEdits.id, editId), eq(pendingEdits.status, 'pending')))
  )[0];
  if (!row) return { error: 'Edit is not pending.' };
  await db()
    .update(pendingEdits)
    .set({ status: 'rejected', reviewNote: note, reviewedBy: adminId, reviewedAt: new Date() })
    .where(eq(pendingEdits.id, editId));
  for (const key of pendingOnlyKeys(row.listing, row.edit.changes)) await deleteMedia(key);
  return { ok: `Rejected edit to “${row.listing.name}”.` };
}
