import { WEEKDAYS, type Hours } from '../db/schema';

const SCHEMA_DAY: Record<string, string> = Object.fromEntries(WEEKDAYS.map((d) => [d, `https://schema.org/${d}`]));

/** schema.org openingHoursSpecification entries for LocalBusiness JSON-LD. */
export function toOpeningHoursSpec(hours: Hours | null) {
  if (!hours) return undefined;
  const spec = WEEKDAYS.flatMap((day) =>
    (hours[day] ?? []).map((r) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: SCHEMA_DAY[day],
      opens: r.open,
      closes: r.close,
    })),
  );
  return spec.length ? spec : undefined;
}

function to12h(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const suffix = h >= 12 && h < 24 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

/** Rows for display, Monday first. Days missing from the data are omitted. */
export function displayHours(hours: Hours | null): { day: string; text: string }[] {
  if (!hours) return [];
  return WEEKDAYS.filter((d) => d in hours).map((day) => {
    const ranges = hours[day] ?? [];
    if (!ranges.length) return { day, text: 'Closed' };
    if (ranges.length === 1 && ranges[0]!.open === '00:00' && ranges[0]!.close === '23:59') return { day, text: 'Open 24 hours' };
    return { day, text: ranges.map((r) => `${to12h(r.open)} – ${to12h(r.close)}`).join(', ') };
  });
}
