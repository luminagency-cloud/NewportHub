/** Owner stories: admin reads and writes. Public reads are in queries.ts. */
import { and, desc, eq, ne } from 'drizzle-orm';
import { listings, stories, towns } from '../db/schema';
import { db } from './db';
import { slugify } from './slug';
import { dayToDate, parseListingRef, type StoryFormValues } from './story-form';

/** Every story, newest change first, with its business. */
export async function adminStories() {
  return db()
    .select({
      id: stories.id, slug: stories.slug, title: stories.title, status: stories.status, series: stories.series,
      ownerApprovedAt: stories.ownerApprovedAt, publishedAt: stories.publishedAt, updatedAt: stories.updatedAt,
      listingId: listings.id, listingName: listings.name, listingSlug: listings.slug, listingStatus: listings.status,
    })
    .from(stories)
    .innerJoin(listings, eq(stories.listingId, listings.id))
    .orderBy(desc(stories.updatedAt), desc(stories.id));
}

export async function adminStory(id: number) {
  return (
    await db()
      .select({ story: stories, listing: { id: listings.id, name: listings.name, slug: listings.slug, status: listings.status } })
      .from(stories)
      .innerJoin(listings, eq(stories.listingId, listings.id))
      .where(eq(stories.id, id))
      .limit(1)
  )[0];
}

/** Stories about one listing (any status), for its admin page. */
export async function storiesForListing(listingId: number) {
  return db()
    .select({ id: stories.id, slug: stories.slug, title: stories.title, status: stories.status })
    .from(stories)
    .where(eq(stories.listingId, listingId))
    .orderBy(desc(stories.updatedAt));
}

/** The listing an admin typed (id, URL name, or /listing/… link), any status. */
export async function findListing(ref: string) {
  const r = parseListingRef(ref);
  if (!r) return undefined;
  return (
    await db()
      .select({ id: listings.id, name: listings.name, slug: listings.slug, status: listings.status, townName: towns.name })
      .from(listings)
      .leftJoin(towns, eq(listings.townId, towns.id))
      .where('id' in r ? eq(listings.id, r.id) : eq(listings.slug, r.slug))
      .limit(1)
  )[0];
}

async function slugTaken(slug: string, exceptId: number | null) {
  const row = (await db().select({ id: stories.id }).from(stories).where(exceptId ? and(eq(stories.slug, slug), ne(stories.id, exceptId)) : eq(stories.slug, slug)).limit(1))[0];
  return !!row;
}

async function freeSlug(base: string) {
  const root = slugify(base).slice(0, 90).replace(/-+$/, '') || 'story';
  let slug = root;
  for (let n = 2; await slugTaken(slug, null); n++) slug = `${root}-${n}`;
  return slug;
}

/**
 * Create (id null) or update a story. The URL name defaults to the business name. `publishedAt` is
 * set the first time the story goes live and kept after that.
 */
export async function saveStory(id: number | null, v: StoryFormValues): Promise<{ id: number } | { error: string }> {
  const current = id ? (await db().select().from(stories).where(eq(stories.id, id)).limit(1))[0] : undefined;
  if (id && !current) return { error: 'That story no longer exists.' };
  const listing = await findListing(v.listingRef);
  if (!listing) return { error: `No business found for “${v.listingRef}”. Use its URL name (the part after /listing/), a listing link, or its id.` };

  let slug = v.slug || current?.slug || '';
  if (!slug) slug = await freeSlug(listing.name);
  else if (await slugTaken(slug, id)) return { error: `The URL name “${slug}” is already used by another story.` };

  const now = new Date();
  const fields = {
    listingId: listing.id,
    slug,
    title: v.title,
    summary: v.summary,
    body: v.body,
    pullQuote: v.pullQuote,
    interviewee: v.interviewee,
    series: v.series,
    sourceInterviewId: v.sourceInterviewId,
    ownerApprovedAt: v.ownerApprovedOn ? dayToDate(v.ownerApprovedOn) : null,
    status: v.status,
    publishedAt: current?.publishedAt ?? (v.status === 'published' ? now : null),
    updatedAt: now,
  };
  if (current) {
    await db().update(stories).set(fields).where(eq(stories.id, current.id));
    return { id: current.id };
  }
  const [row] = await db().insert(stories).values(fields).returning({ id: stories.id });
  return { id: row!.id };
}

export async function deleteStory(id: number): Promise<boolean> {
  const rows = await db().delete(stories).where(eq(stories.id, id)).returning({ id: stories.id });
  return rows.length > 0;
}
