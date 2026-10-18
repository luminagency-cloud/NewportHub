/**
 * Import an Outscraper Google Maps CSV export into D1.
 *
 *   npx tsx scripts/seed-outscraper.ts [file.csv] [--local | --remote]
 *
 * Every imported listing is status=published, tier=free, unclaimed. Re-running is safe: rows are
 * matched on Outscraper's place_id, source fields are refreshed, and tier/status/owner/Stripe
 * fields are left alone so claims and paid tiers survive a re-import.
 *
 * The script writes data/seed.sql and runs it with `wrangler d1 execute`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { WEEKDAYS, type Hours, type Weekday } from '../src/db/schema';
import { RESERVED_SLUGS, slugify } from '../src/lib/slug';
import { parseDay } from '../src/lib/hours-parse';

const args = process.argv.slice(2);
const target = args.includes('--remote') ? '--remote' : '--local';
const csvPath = args.find((a) => !a.startsWith('--')) ?? 'data/sample-outscraper.csv';
const outPath = 'data/seed.sql';

type Row = Record<string, string | undefined>;

const US_STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

const val = (row: Row, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[k]?.trim();
    if (v) return v;
  }
  return null;
};

function stateCode(raw: string | null): string | null {
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return US_STATES[raw.toLowerCase()] ?? null;
}

/**
 * Outscraper `working_hours` appears as a JSON object ({"Monday": "9AM-5PM", ...}, values sometimes
 * arrays) or in the old pipe format ("Monday,9AM-5PM|Tuesday,..."). Unreadable days are dropped.
 */
function parseHours(raw: string | null): Hours | null {
  if (!raw) return null;
  let byDay: Record<string, unknown> = {};
  try {
    byDay = JSON.parse(raw);
  } catch {
    try {
      byDay = JSON.parse(raw.replace(/'/g, '"'));
    } catch {
      for (const chunk of raw.split('|')) {
        const i = chunk.indexOf(',');
        if (i > 0) byDay[chunk.slice(0, i).trim()] = chunk.slice(i + 1);
      }
    }
  }
  const hours: Hours = {};
  for (const [k, v] of Object.entries(byDay)) {
    const day = WEEKDAYS.find((d) => d.toLowerCase() === k.trim().toLowerCase()) as Weekday | undefined;
    if (!day) continue;
    const text = Array.isArray(v) ? v.join(',') : String(v ?? '');
    const parsed = parseDay(text);
    if (parsed) hours[day] = parsed;
  }
  return Object.keys(hours).length ? hours : null;
}

// ---- wrangler --------------------------------------------------------------

function d1Query<T>(sql: string): T[] {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', target, '--json', '--command', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return (JSON.parse(out) as { results: T[] }[])[0]?.results ?? [];
}

const q = (v: string | number | null | undefined) =>
  v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`;

// ---- main ------------------------------------------------------------------

const rows: Row[] = parse(readFileSync(csvPath), { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });
console.log(`Read ${rows.length} rows from ${csvPath}`);

const existingListings = d1Query<{ slug: string; source_place_id: string | null }>('SELECT slug, source_place_id FROM listings');
const existingCats = new Set(d1Query<{ slug: string }>('SELECT slug FROM categories').map((r) => r.slug));
const existingTowns = new Set(d1Query<{ slug: string }>('SELECT slug FROM towns').map((r) => r.slug));

const slugByPlace = new Map(existingListings.filter((r) => r.source_place_id).map((r) => [r.source_place_id!, r.slug]));
const takenSlugs = new Set(existingListings.map((r) => r.slug));

const cats = new Map<string, string>(); // slug -> name
const townRows = new Map<string, { name: string; state: string }>();
const statements: string[] = [];
const skipped: string[] = [];

for (const [i, row] of rows.entries()) {
  const name = val(row, 'name');
  const placeId = val(row, 'place_id', 'google_id');
  const catName = val(row, 'category', 'type') ?? val(row, 'subtypes')?.split(',')[0]?.trim() ?? null;
  const city = val(row, 'city');
  const state = stateCode(val(row, 'us_state', 'state'));
  const label = `row ${i + 2}${name ? ` (${name})` : ''}`;

  if (val(row, 'business_status') === 'CLOSED_PERMANENTLY') { skipped.push(`${label}: permanently closed`); continue; }
  if (!name || !catName || !city || !state) { skipped.push(`${label}: missing name, category, city, or state`); continue; }

  const catSlug = slugify(catName);
  const townSlug = slugify(city);
  cats.set(catSlug, cats.get(catSlug) ?? catName);
  if (!townRows.has(townSlug)) townRows.set(townSlug, { name: city, state });

  let slug = placeId ? slugByPlace.get(placeId) : undefined;
  if (!slug) {
    const base = slugify(`${name} ${city}`);
    slug = base;
    for (let n = 2; takenSlugs.has(slug); n++) slug = `${base}-${n}`;
    takenSlugs.add(slug);
    if (placeId) slugByPlace.set(placeId, slug);
  }

  const lat = Number(val(row, 'latitude'));
  const lng = Number(val(row, 'longitude'));
  const hours = parseHours(val(row, 'working_hours', 'working_hours_old_format'));
  const fields = {
    slug,
    name,
    category_id: `(SELECT id FROM categories WHERE slug = ${q(catSlug)})`,
    town_id: `(SELECT id FROM towns WHERE slug = ${q(townSlug)})`,
    address: q(val(row, 'full_address', 'address')),
    phone: q(val(row, 'phone', 'phone_1')),
    website: q(val(row, 'site', 'website')),
    email: q(val(row, 'email', 'email_1')),
    description: q(val(row, 'description', 'about')),
    hours: q(hours ? JSON.stringify(hours) : null),
    lat: Number.isFinite(lat) && lat !== 0 ? String(lat) : 'NULL',
    lng: Number.isFinite(lng) && lng !== 0 ? String(lng) : 'NULL',
    source_place_id: q(placeId),
  };
  const cols = Object.keys(fields);
  const values = Object.entries(fields).map(([k, v]) => (k === 'slug' || k === 'name' ? q(v) : v));
  // Source fields only: tier, status, owner, and Stripe ids stay as they are on re-import.
  const refresh = cols
    .filter((c) => !['slug', 'source_place_id'].includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .concat('updated_at = unixepoch()')
    .join(', ');
  const conflict = placeId ? `ON CONFLICT(source_place_id) DO UPDATE SET ${refresh}` : 'ON CONFLICT(slug) DO NOTHING';
  statements.push(
    `INSERT INTO listings (${cols.join(', ')}, status, tier) VALUES (${values.join(', ')}, 'published', 'free') ${conflict};`,
  );
}

// /[slug]/ serves categories and towns. The DB triggers would reject a clash mid-import; fail early and clearly instead.
const allCats = new Set([...existingCats, ...cats.keys()]);
const allTowns = new Set([...existingTowns, ...townRows.keys()]);
const clashes = [...allCats].filter((s) => allTowns.has(s) || RESERVED_SLUGS.has(s))
  .concat([...allTowns].filter((s) => RESERVED_SLUGS.has(s)));
if (clashes.length) {
  console.error(`Slug clash between categories, towns, or reserved routes: ${[...new Set(clashes)].join(', ')}`);
  console.error('Rename the category or town in the CSV and run again. Nothing was written.');
  process.exit(1);
}

const sql = [
  ...[...cats].map(([slug, name]) => `INSERT INTO categories (slug, name) VALUES (${q(slug)}, ${q(name)}) ON CONFLICT(slug) DO NOTHING;`),
  ...[...townRows].map(([slug, t]) => `INSERT INTO towns (slug, name, state) VALUES (${q(slug)}, ${q(t.name)}, ${q(t.state)}) ON CONFLICT(slug) DO NOTHING;`),
  ...statements,
].join('\n');
writeFileSync(outPath, sql + '\n');

console.log(`Categories: ${cats.size}, towns: ${townRows.size}, listings: ${statements.length}, skipped: ${skipped.length}`);
for (const s of skipped) console.log(`  skipped ${s}`);

execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', target, '--file', outPath, ...(target === '--remote' ? ['--yes'] : [])], {
  stdio: 'inherit',
});
