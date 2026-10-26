import { STATUSES, TIERS, type Hours, type ListingChanges } from '../db/schema';
import { hoursFromForm } from './hours-parse';
import { PAID_DESCRIPTION_LIMIT } from './plans';
import { slugify } from './slug';

export interface ListingFormValues {
  name: string;
  categoryId: number | null;
  townId: number | null;
  suggestedCategory: string | null;
  suggestedTown: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  description: string | null;
  hours: Hours | null;
  socialUrl: string | null;
  menuUrl: string | null;
  bookingUrl: string | null;
}

const text = (form: FormData, key: string, max: number) => {
  const v = String(form.get(key) ?? '').trim().replace(/\s+\n/g, '\n');
  return v ? v.slice(0, max) : null;
};
const id = (form: FormData, key: string) => {
  const n = Number(form.get(key));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** http(s) URL, or null. Bare domains get https:// and no trailing slash. */
function httpUrl(raw: string | null, label: string, errors: string[]): string | null {
  if (!raw) return null;
  let website = raw;
  if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
  try {
    const u = new URL(website);
    if (!u.hostname.includes('.')) throw new Error();
    return u.pathname === '/' && !u.search && !u.hash ? u.origin : u.href;
  } catch {
    errors.push(`${label} must be a valid address, e.g. https://example.com`);
    return raw;
  }
}

/**
 * Validate the shared listing form. `allowSuggestions` lets a new submission name a category or
 * town that does not exist yet (form value "new" plus a text field); edits must use existing ones.
 */
export function parseListingForm(
  form: FormData,
  opts: { categoryIds: Set<number>; townIds: Set<number>; allowSuggestions: boolean },
): { values: ListingFormValues; errors: string[] } {
  const errors: string[] = [];
  const name = text(form, 'name', 120) ?? '';
  if (!name) errors.push('Business name is required.');

  let categoryId = id(form, 'categoryId');
  let suggestedCategory: string | null = null;
  if (opts.allowSuggestions && form.get('categoryId') === 'new') {
    suggestedCategory = text(form, 'suggestedCategory', 60);
    if (!suggestedCategory) errors.push('Enter the new category name.');
  } else if (!categoryId || !opts.categoryIds.has(categoryId)) {
    categoryId = null;
    errors.push('Choose a category.');
  }

  let townId = id(form, 'townId');
  let suggestedTown: string | null = null;
  if (opts.allowSuggestions && form.get('townId') === 'new') {
    suggestedTown = text(form, 'suggestedTown', 60);
    if (!suggestedTown) errors.push('Enter the new town name.');
  } else if (!townId || !opts.townIds.has(townId)) {
    townId = null;
    errors.push('Choose a town.');
  }

  const website = httpUrl(text(form, 'website', 300), 'Website', errors);

  const email = text(form, 'email', 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email address is not valid.');

  const { hours, errors: hourErrors } = hoursFromForm(form);
  errors.push(...hourErrors);

  return {
    values: {
      name,
      categoryId: suggestedCategory ? null : categoryId,
      townId: suggestedTown ? null : townId,
      suggestedCategory,
      suggestedTown,
      address: text(form, 'address', 200),
      phone: text(form, 'phone', 40),
      website,
      email: email?.toLowerCase() ?? null,
      description: text(form, 'description', PAID_DESCRIPTION_LIMIT),
      hours,
      socialUrl: httpUrl(text(form, 'socialUrl', 300), 'Social link', errors),
      menuUrl: httpUrl(text(form, 'menuUrl', 300), 'Menu link', errors),
      bookingUrl: httpUrl(text(form, 'bookingUrl', 300), 'Booking link', errors),
    },
    errors,
  };
}

const EDITABLE = [
  'name', 'categoryId', 'townId', 'address', 'phone', 'website', 'email', 'description', 'hours',
  'socialUrl', 'menuUrl', 'bookingUrl', 'logoR2Key', 'photos',
] as const;

/** Only the fields that differ from the current listing. Empty object = nothing changed. */
export function diffChanges(current: Record<string, unknown>, next: ListingChanges): ListingChanges {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (!(k in next)) continue;
    if (JSON.stringify(current[k] ?? null) !== JSON.stringify(next[k] ?? null)) out[k] = next[k] ?? null;
  }
  return out as ListingChanges;
}

export interface AdminFields {
  status: (typeof STATUSES)[number];
  tier: (typeof TIERS)[number];
  /** Slugified; empty means "make one from the name". */
  slug: string;
  /** Raw owner field: a Clerk user id (user_…), an email address, or empty for no owner. */
  owner: string;
}

/** The admin-only fields of the admin listing form (owner lookup happens in the page). */
export function parseAdminFields(form: FormData): { values: AdminFields; errors: string[] } {
  const errors: string[] = [];
  const status = String(form.get('status') ?? '') as AdminFields['status'];
  if (!STATUSES.includes(status)) errors.push('Choose a status.');
  const tier = String(form.get('tier') ?? '') as AdminFields['tier'];
  if (!TIERS.includes(tier)) errors.push('Choose a plan.');
  const rawSlug = String(form.get('slug') ?? '').trim();
  const slug = slugify(rawSlug);
  if (rawSlug && !slug) errors.push('The URL name needs letters or numbers.');
  const owner = String(form.get('owner') ?? '').trim();
  if (owner && !/^user_[A-Za-z0-9]+$/.test(owner) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner))
    errors.push('Owner must be an email address or a Clerk user id (user_…), or empty.');
  return { values: { status, tier, slug, owner }, errors };
}

/** field → [before, after] for every key whose value differs (compared as JSON). */
export function fieldChanges(current: Record<string, unknown>, next: Record<string, unknown>): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const [k, v] of Object.entries(next)) {
    const before = current[k] ?? null;
    if (JSON.stringify(before) !== JSON.stringify(v ?? null)) out[k] = [before, v ?? null];
  }
  return out;
}
