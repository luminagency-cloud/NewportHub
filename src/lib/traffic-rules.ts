/** Pure traffic helpers (no runtime imports), unit-tested. */
import { TRAFFIC_KINDS, type TrafficKind } from '../db/schema';

/** The beacon body `{"l": <listing id>, "k": <kind>}`, or null if it is anything else. */
export function parseTrackBody(text: string): { listingId: number; kind: TrafficKind } | null {
  if (text.length > 200) return null;
  try {
    const { l, k } = JSON.parse(text) as { l?: unknown; k?: unknown };
    if (!Number.isInteger(l) || (l as number) <= 0) return null;
    if (k === 'view' || !TRAFFIC_KINDS.includes(k as TrafficKind)) return null; // views are counted server-side
    return { listingId: l as number, kind: k as TrafficKind };
  } catch {
    return null;
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD `days` days before `day`. */
export function daysBefore(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** A from/to day range from query values; defaults to the 30 days ending today. Swapped if reversed. */
export function dayRange(from: string | null, to: string | null, today: string): { from: string; to: string } {
  let f = from && DAY.test(from) ? from : daysBefore(today, 29);
  let t = to && DAY.test(to) ? to : today;
  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
}
