/** Parse free-text opening hours ("9AM-5PM", "11-2PM, 5-9PM", "Closed", "Open 24 hours"). Shared by the seed script and owner forms. */
import { WEEKDAYS, type Hours } from '../db/schema';

/** "9", "9:30", "9AM", "9:30 PM" -> minutes past midnight, plus the meridiem if given. */
function parseClock(s: string): { mins: number; mer: 'AM' | 'PM' | null } | null {
  const t = s.trim().toUpperCase().replace(/\./g, '');
  if (t === 'NOON') return { mins: 12 * 60, mer: 'PM' };
  if (t === 'MIDNIGHT') return { mins: 0, mer: 'AM' };
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return { mins: h * 60 + min, mer: (m[3] as 'AM' | 'PM' | undefined) ?? null };
}

function apply(c: { mins: number; mer: 'AM' | 'PM' | null }, mer: 'AM' | 'PM' | null): number {
  const h = Math.floor(c.mins / 60) % 12;
  const min = c.mins % 60;
  if (!mer) return c.mins; // 24-hour clock
  return (mer === 'PM' ? h + 12 : h) * 60 + min;
}

const hhmm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** One day's text, e.g. "11AM-2PM,5-9PM", "Closed", "Open 24 hours". Returns null when unreadable. */
export function parseDay(text: string): { open: string; close: string }[] | null {
  const t = text.replace(/[\u202f\u00a0]/g, ' ').trim();
  if (/closed/i.test(t)) return [];
  if (/24\s*hours/i.test(t)) return [{ open: '00:00', close: '23:59' }];
  const ranges: { open: string; close: string }[] = [];
  for (const part of t.split(/[,;]/)) {
    const [a, b] = part.split(/\s*[-–—]\s*/);
    if (!a || !b) return null;
    const start = parseClock(a);
    const end = parseClock(b);
    if (!start || !end) return null;
    const endMins = apply(end, end.mer);
    let startMins = apply(start, start.mer ?? end.mer);
    // "11-2PM" means 11 AM: a start borrowed from the end's meridiem cannot come after the end.
    if (!start.mer && end.mer === 'PM' && startMins > endMins) startMins -= 12 * 60;
    ranges.push({ open: hhmm(startMins), close: hhmm(endMins) });
  }
  return ranges;
}

/** Inverse of parseDay, for prefilling form fields: "09:00-17:00, 18:00-21:00" or "Closed". */
export function formatDay(ranges: { open: string; close: string }[] | undefined): string {
  if (ranges === undefined) return '';
  if (!ranges.length) return 'Closed';
  if (ranges.length === 1 && ranges[0]!.open === '00:00' && ranges[0]!.close === '23:59') return 'Open 24 hours';
  return ranges.map((r) => `${r.open}-${r.close}`).join(', ');
}

/** Build Hours from per-day form fields named hours_Monday … hours_Sunday. Blank days are omitted. */
export function hoursFromForm(form: FormData): { hours: Hours | null; errors: string[] } {
  const hours: Hours = {};
  const errors: string[] = [];
  for (const day of WEEKDAYS) {
    const text = String(form.get(`hours_${day}`) ?? '').trim();
    if (!text) continue;
    const parsed = parseDay(text);
    if (parsed) hours[day] = parsed;
    else errors.push(`${day}: could not read "${text}". Use e.g. 9am-5pm, 11-2pm, 5-9pm, or Closed.`);
  }
  return { hours: Object.keys(hours).length ? hours : null, errors };
}
