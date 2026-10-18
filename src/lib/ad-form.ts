/** Pure banner-ad helpers (no runtime imports) so they are unit-testable. */
import { AD_PLACEMENTS, type AdPlacement } from '../db/schema';

export const PLACEMENT_LABELS: Record<AdPlacement, string> = {
  home_top: 'Home page, top (wide, e.g. 1200×200)',
  category_sidebar: 'Category pages, sidebar (e.g. 300×250)',
};

/** Ad days follow Newport local time. */
export const AD_TIME_ZONE = 'America/New_York';

/** YYYY-MM-DD for `date` in the ad time zone. */
export function adDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AD_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Crawlers and link previewers are not counted as impressions or clicks. */
export function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|curl|wget|python-requests|headless/i.test(userAgent);
}

export interface AdFormValues {
  name: string;
  altText: string;
  linkUrl: string;
  placement: AdPlacement;
  startDate: string;
  endDate: string;
  active: boolean;
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export function parseAdForm(form: FormData): { values: AdFormValues; errors: string[] } {
  const get = (k: string, max: number) => String(form.get(k) ?? '').trim().slice(0, max);
  const errors: string[] = [];
  const name = get('name', 80);
  const altText = get('altText', 150);
  let linkUrl = get('linkUrl', 500);
  const placement = get('placement', 40) as AdPlacement;
  const startDate = get('startDate', 10);
  const endDate = get('endDate', 10);

  if (!name) errors.push('Name is required.');
  if (!altText) errors.push('Alt text is required (describe the image for screen readers).');
  try {
    const u = new URL(linkUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    linkUrl = u.href;
  } catch {
    errors.push('Link must be a full http(s) URL, e.g. https://example.com/offer');
  }
  if (!AD_PLACEMENTS.includes(placement)) errors.push('Choose a placement.');
  if (!isDay(startDate) || !isDay(endDate)) errors.push('Start and end dates are required.');
  else if (endDate < startDate) errors.push('End date must be on or after the start date.');

  return { values: { name, altText, linkUrl, placement, startDate, endDate, active: form.get('active') === 'on' }, errors };
}
