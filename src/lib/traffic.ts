import { and, between, desc, eq, sql } from 'drizzle-orm';
import { listings, listingStats, TRAFFIC_KINDS, type TrafficKind } from '../db/schema';
import { adDay, isBot } from './ad-form';
import { db } from './db';

/**
 * Count one view or outbound click for a published listing (today, New York time). Bots are not
 * counted, and an id that is not a published listing adds nothing.
 */
export async function recordListingEvent(listingId: number, kind: TrafficKind, userAgent: string | null) {
  if (isBot(userAgent)) return;
  await db().run(sql`
    INSERT INTO listing_stats (listing_id, day, kind, count)
    SELECT ${listingId}, ${adDay()}, ${kind}, 1
    WHERE EXISTS (SELECT 1 FROM listings WHERE id = ${listingId} AND status = 'published')
    ON CONFLICT (listing_id, day, kind) DO UPDATE SET count = count + 1`);
}

export type TrafficTotals = Record<TrafficKind, number> & { clicks: number };

const totals = (rows: { kind: TrafficKind; n: number }[]): TrafficTotals => {
  const t = Object.fromEntries(TRAFFIC_KINDS.map((k) => [k, 0])) as TrafficTotals;
  for (const r of rows) t[r.kind] = r.n;
  t.clicks = TRAFFIC_KINDS.filter((k) => k !== 'view').reduce((n, k) => n + t[k], 0);
  return t;
};

/** One listing's totals by kind for a day range (inclusive), plus all time. */
export async function listingTraffic(listingId: number, from: string, to: string) {
  const q = (range: boolean) =>
    db()
      .select({ kind: listingStats.kind, n: sql<number>`sum(${listingStats.count})` })
      .from(listingStats)
      .where(and(eq(listingStats.listingId, listingId), range ? between(listingStats.day, from, to) : undefined))
      .groupBy(listingStats.kind);
  const [inRange, allTime] = await Promise.all([q(true), q(false)]);
  return { range: totals(inRange), allTime: totals(allTime) };
}

/** Site-wide totals for a day range, and the listings that sent the most clicks out. */
export async function trafficSummary(from: string, to: string, limit = 50) {
  const inRange = between(listingStats.day, from, to);
  const clicks = sql<number>`sum(CASE WHEN ${listingStats.kind} = 'view' THEN 0 ELSE ${listingStats.count} END)`;
  const views = sql<number>`sum(CASE WHEN ${listingStats.kind} = 'view' THEN ${listingStats.count} ELSE 0 END)`;
  const [byKind, top] = await Promise.all([
    db().select({ kind: listingStats.kind, n: sql<number>`sum(${listingStats.count})` }).from(listingStats).where(inRange).groupBy(listingStats.kind),
    db()
      .select({
        id: listings.id, name: listings.name, slug: listings.slug,
        views,
        website: sql<number>`sum(CASE WHEN ${listingStats.kind} = 'website' THEN ${listingStats.count} ELSE 0 END)`,
        phone: sql<number>`sum(CASE WHEN ${listingStats.kind} = 'phone' THEN ${listingStats.count} ELSE 0 END)`,
        clicks,
      })
      .from(listingStats)
      .innerJoin(listings, eq(listingStats.listingId, listings.id))
      .where(inRange)
      .groupBy(listings.id)
      .orderBy(desc(clicks), desc(views))
      .limit(limit),
  ]);
  return { totals: totals(byKind), top };
}
