/**
 * Basic / Plus / Featured. Pure rules, no runtime imports.
 *
 * Internal keys used to be free / featured / premium. There were no paying customers.
 * The old middle plan was `featured` and the old top plan was `premium`, so:
 *   free → basic, featured → plus, premium → featured.
 * The migration applies that in this order so the name "featured" is free before the
 * old top plan takes it. Do not map the old `featured` key onto the new Featured plan.
 */
import type { Hours } from '../db/schema';

export const TIERS = ['basic', 'plus', 'featured'] as const;
export type Tier = (typeof TIERS)[number];

/** Old stored tier → new tier. `featured` here is the old middle plan. */
export const LEGACY_TIER_MAP = {
  free: 'basic',
  featured: 'plus',
  premium: 'featured',
} as const;

export type LegacyTier = keyof typeof LEGACY_TIER_MAP;

export const TIER_LABELS: Record<Tier, string> = {
  basic: 'Basic',
  plus: 'Plus',
  featured: 'Featured',
};

/** Decided prices. Stripe ids live in env vars; these amounts are what the plan page shows. */
export const PLAN_PRICES = {
  plus: { month: 19, year: 190 },
  featured: { month: 29, year: 290 },
} as const;

export const BASIC_DESCRIPTION_LIMIT = 250;
export const PAID_DESCRIPTION_LIMIT = 2000;
/** Cover plus this many more. */
export const MAX_EXTRA_PHOTOS = 3;
export const MAX_PHOTOS = MAX_EXTRA_PHOTOS + 1;

export const isPaid = (tier: Tier) => tier === 'plus' || tier === 'featured';
export const showsHours = isPaid;
export const showsLinks = isPaid;
export const showsExtraPhotos = isPaid;
export const canPostEvents = isPaid;

export function descriptionLimit(tier: Tier): number {
  return tier === 'basic' ? BASIC_DESCRIPTION_LIMIT : PAID_DESCRIPTION_LIMIT;
}

/** First ~250 characters, on a word boundary when one is close. */
export function descriptionExcerpt(description: string, limit: number): string {
  if (description.length <= limit) return description;
  const cut = description.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return (space >= limit - 40 ? cut.slice(0, space) : cut).trimEnd();
}

/** What the public site may show. Basic keeps a long description stored and shows the excerpt. */
export function publicDescription(description: string | null | undefined, tier: Tier): string | null {
  if (!description) return null;
  if (tier !== 'basic') return description;
  return descriptionExcerpt(description, BASIC_DESCRIPTION_LIMIT);
}

/**
 * Description to store from an owner save. A Basic save that resubmits the public excerpt
 * keeps the full stored text, so a downgrade does not delete it.
 */
export function descriptionForSave(tier: Tier, submitted: string | null, stored: string | null): string | null {
  const limit = descriptionLimit(tier);
  if (!submitted) return null;
  if (tier === 'basic' && stored && (submitted === stored || submitted === publicDescription(stored, 'basic'))) return stored;
  return submitted.length > limit ? submitted.slice(0, limit) : submitted;
}

export interface PaidContent {
  description: string | null;
  hours: Hours | null;
  socialUrl: string | null;
  menuUrl: string | null;
  bookingUrl: string | null;
}

/**
 * Fields a Basic owner is not allowed to change. Submitted values for those fields are
 * dropped and the stored values kept (hidden on the site until the listing is paid again).
 */
/**
 * Category a Basic owner is allowed to file on. Parents are always allowed. A subcategory is
 * allowed only when the listing is already on it (a downgrade keeps it). A new Basic listing
 * that submits a subcategory is filed on that subcategory's parent. Paid plans can choose any.
 * `parentById` maps a category id to its parent; a parent category maps to null.
 */
export function categoryForTier(
  tier: Tier,
  submittedId: number | null,
  storedId: number | null,
  parentById: ReadonlyMap<number, number | null>,
): number | null {
  if (submittedId == null || isPaid(tier)) return submittedId;
  const parent = parentById.get(submittedId);
  if (parent == null) return submittedId;
  if (submittedId === storedId) return submittedId;
  return storedId ?? parent;
}

export function restrictPaidFields<T extends PaidContent>(tier: Tier, next: T, stored: PaidContent): T {
  const description = descriptionForSave(tier, next.description, stored.description);
  if (isPaid(tier)) return { ...next, description };
  return {
    ...next,
    description,
    hours: stored.hours,
    socialUrl: stored.socialUrl,
    menuUrl: stored.menuUrl,
    bookingUrl: stored.bookingUrl,
  };
}

/**
 * Imports always create Basic listings. Hours in the export (`working_hours` and similar)
 * are ignored on purpose, even when the cell is filled in.
 */
export function hoursImportedForBasic(workingHours: string | null | undefined): null {
  void workingHours;
  return null;
}

/** Fisher–Yates. Pass `random` in tests. Featured rows use this once per page view. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** One page of a category listing: Plus and Featured cards, then Basic rows. */
export function splitCategoryPage<T extends { tier: Tier }>(pageRows: readonly T[]): { main: T[]; basic: T[] } {
  return {
    main: pageRows.filter((r) => r.tier !== 'basic'),
    basic: pageRows.filter((r) => r.tier === 'basic'),
  };
}
