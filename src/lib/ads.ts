import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { adStats, bannerAds, type AdPlacement, type BannerAd } from '../db/schema';
import { adDay, isBot, type AdFormValues } from './ad-form';
import { db } from './db';
import { deleteMedia, MAX_BANNER_BYTES, uploadImage } from './media';

/** One ad for a placement: active and within its date range today. Rotation is a uniform random pick. */
export async function pickAd(placement: AdPlacement): Promise<BannerAd | undefined> {
  const today = adDay();
  return (
    await db()
      .select()
      .from(bannerAds)
      .where(and(eq(bannerAds.placement, placement), eq(bannerAds.active, true), lte(bannerAds.startDate, today), gte(bannerAds.endDate, today)))
      .orderBy(sql`RANDOM()`)
      .limit(1)
  )[0];
}

export const isLive = (ad: Pick<BannerAd, 'active' | 'startDate' | 'endDate'>, today = adDay()) =>
  ad.active && ad.startDate <= today && today <= ad.endDate;

/** Add one impression or click to today's row for the ad. Bots are skipped. */
export async function recordAdEvent(adId: number, kind: 'impression' | 'click', userAgent: string | null) {
  if (isBot(userAgent)) return;
  const imp = kind === 'impression' ? 1 : 0;
  const clk = kind === 'click' ? 1 : 0;
  await db()
    .insert(adStats)
    .values({ adId, day: adDay(), impressions: imp, clicks: clk })
    .onConflictDoUpdate({
      target: [adStats.adId, adStats.day],
      set: { impressions: sql`${adStats.impressions} + ${imp}`, clicks: sql`${adStats.clicks} + ${clk}` },
    });
}

export async function getAd(id: number): Promise<BannerAd | undefined> {
  return (await db().select().from(bannerAds).where(eq(bannerAds.id, id)).limit(1))[0];
}

/** All ads with lifetime and last-30-day totals, newest first. */
export async function adsWithStats() {
  const since = adDay(new Date(Date.now() - 29 * 86400_000));
  return db()
    .select({
      ad: bannerAds,
      impressions: sql<number>`coalesce(sum(${adStats.impressions}), 0)`,
      clicks: sql<number>`coalesce(sum(${adStats.clicks}), 0)`,
      impressions30: sql<number>`coalesce(sum(case when ${adStats.day} >= ${since} then ${adStats.impressions} end), 0)`,
      clicks30: sql<number>`coalesce(sum(case when ${adStats.day} >= ${since} then ${adStats.clicks} end), 0)`,
    })
    .from(bannerAds)
    .leftJoin(adStats, eq(adStats.adId, bannerAds.id))
    .groupBy(bannerAds.id)
    .orderBy(desc(bannerAds.id));
}

/** Create (image required) or update (image optional; replacing deletes the old object). */
export async function saveAd(values: AdFormValues, image: FormDataEntryValue | null, existing?: BannerAd): Promise<{ id: number } | { error: string }> {
  const up = await uploadImage(image, `banners/${values.placement}`, { maxBytes: MAX_BANNER_BYTES, label: 'Banner image' });
  if (up.error) return { error: up.error };
  if (!existing) {
    if (!up.key) return { error: 'Choose a banner image.' };
    const [row] = await db().insert(bannerAds).values({ ...values, imageR2Key: up.key }).returning({ id: bannerAds.id });
    return { id: row!.id };
  }
  await db().update(bannerAds).set({ ...values, ...(up.key ? { imageR2Key: up.key } : {}) }).where(eq(bannerAds.id, existing.id));
  if (up.key) await deleteMedia(existing.imageR2Key);
  return { id: existing.id };
}

/** Delete an ad, its stats (FK cascade, plus an explicit delete in case FKs are off), and its image. */
export async function deleteAd(id: number) {
  const ad = await getAd(id);
  if (!ad) return false;
  await db().batch([db().delete(adStats).where(eq(adStats.adId, id)), db().delete(bannerAds).where(eq(bannerAds.id, id))]);
  await deleteMedia(ad.imageR2Key);
  return true;
}
