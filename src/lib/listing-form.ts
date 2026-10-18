import type { Hours, ListingChanges } from '../db/schema';
import { hoursFromForm } from './hours-parse';

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
}

const text = (form: FormData, key: string, max: number) => {
  const v = String(form.get(key) ?? '').trim().replace(/\s+\n/g, '\n');
  return v ? v.slice(0, max) : null;
};
const id = (form: FormData, key: string) => {
  const n = Number(form.get(key));
  return Number.isInteger(n) && n > 0 ? n : null;
};

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

  let website = text(form, 'website', 300);
  if (website) {
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    try {
      const u = new URL(website);
      if (!u.hostname.includes('.')) throw new Error();
      // Bare domains stay bare (no trailing slash), so an untouched website is not reported as changed.
      website = u.pathname === '/' && !u.search && !u.hash ? u.origin : u.href;
    } catch {
      errors.push('Website must be a valid address, e.g. https://example.com');
    }
  }

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
      description: text(form, 'description', 2000),
      hours,
    },
    errors,
  };
}

const EDITABLE = ['name', 'categoryId', 'townId', 'address', 'phone', 'website', 'email', 'description', 'hours', 'logoR2Key'] as const;

/** Only the fields that differ from the current listing. Empty object = nothing changed. */
export function diffChanges(current: Record<string, unknown>, next: ListingChanges): ListingChanges {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (!(k in next)) continue;
    if (JSON.stringify(current[k] ?? null) !== JSON.stringify(next[k] ?? null)) out[k] = next[k] ?? null;
  }
  return out as ListingChanges;
}
