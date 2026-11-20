/** Pure owner-story helpers (no runtime imports), unit-tested. */
import { STORY_STATUSES } from '../db/schema';
import { slugify } from './slug';

export interface StoryFormValues {
  /** What the admin typed to pick the business: a listing URL name, a /listing/… link, or an id. */
  listingRef: string;
  title: string;
  /** Slugified; empty means "make one from the business name and title". */
  slug: string;
  summary: string;
  body: string;
  pullQuote: string | null;
  interviewee: string | null;
  series: string | null;
  sourceInterviewId: string | null;
  /** YYYY-MM-DD or null. */
  ownerApprovedOn: string | null;
  status: (typeof STORY_STATUSES)[number];
}

const text = (form: FormData, key: string, max: number) => {
  // Normalize line endings and trailing spaces; keep blank lines (they separate paragraphs).
  const v = String(form.get(key) ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  return v ? v.slice(0, max) : null;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseStoryForm(form: FormData): { values: StoryFormValues; errors: string[] } {
  const errors: string[] = [];
  const listingRef = text(form, 'listing', 300) ?? '';
  if (!listingRef) errors.push('Choose the business this story is about.');
  const title = text(form, 'title', 160) ?? '';
  if (!title) errors.push('Title is required.');
  const summary = text(form, 'summary', 400) ?? '';
  if (!summary) errors.push('Summary is required (one or two sentences).');
  const body = text(form, 'body', 30000) ?? '';
  if (!body) errors.push('Story text is required.');
  const rawSlug = String(form.get('slug') ?? '').trim();
  const slug = slugify(rawSlug).slice(0, 100).replace(/-+$/, '');
  if (rawSlug && !slug) errors.push('The URL name needs letters or numbers.');

  let ownerApprovedOn = text(form, 'ownerApprovedOn', 10);
  if (ownerApprovedOn && (!DAY.test(ownerApprovedOn) || Number.isNaN(Date.parse(`${ownerApprovedOn}T12:00:00Z`)))) {
    errors.push('Owner approval date is not a valid date.');
    ownerApprovedOn = null;
  }
  const status = String(form.get('status') ?? 'draft') as StoryFormValues['status'];
  if (!STORY_STATUSES.includes(status)) errors.push('Choose a status.');
  // The promise to owners: nothing goes live until they approve it.
  if (status === 'published' && !ownerApprovedOn) errors.push('A story can only be published once the owner has approved it: enter the approval date.');

  return {
    values: {
      listingRef,
      title,
      slug,
      summary,
      body,
      pullQuote: text(form, 'pullQuote', 500),
      interviewee: text(form, 'interviewee', 120),
      series: text(form, 'series', 80),
      sourceInterviewId: text(form, 'sourceInterviewId', 100),
      ownerApprovedOn,
      status,
    },
    errors,
  };
}

/** Listing id or slug from what the admin typed: `12`, `corner-cafe-newport`, or a …/listing/<slug> link. */
export function parseListingRef(ref: string): { id: number } | { slug: string } | null {
  const v = ref.trim();
  if (/^\d+$/.test(v)) return Number(v) > 0 ? { id: Number(v) } : null;
  const fromUrl = v.match(/\/listing\/([a-z0-9-]+)/i)?.[1];
  const slug = (fromUrl ?? v).toLowerCase();
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? { slug } : null;
}

/** Story text as paragraphs: blank lines split paragraphs; single line breaks stay inside one. */
export function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Date input value (YYYY-MM-DD) ↔ timestamp at noon UTC, so the day never shifts across time zones. */
export const dayToDate = (day: string) => new Date(`${day}T12:00:00Z`);
export const dateToDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
