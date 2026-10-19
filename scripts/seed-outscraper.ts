/**
 * Import an Outscraper Google Maps CSV export into D1.
 *
 *   npx tsx scripts/seed-outscraper.ts [file.csv] [--local | --remote]
 *
 * Every imported listing is status=published, tier=free (Basic), unclaimed. Re-running is safe: rows
 * are matched on Outscraper's place_id; unclaimed listings get fresh source fields, and claimed
 * listings are left alone so owner edits survive. Tier, status, owner, and Stripe fields are never
 * touched.
 *
 * Categories come from the alias table (seed it first: npm run seed:categories:local); a subcategory
 * hit files the listing on its parent. Rows whose
 * category has no alias are not imported; their source categories are saved to import_unmapped for
 * review. Only the service towns in src/data/taxonomy.ts are imported. Hours are not imported
 * (Basic listings have no hours; Linear LA-190).
 *
 * The script writes data/seed.sql and runs it with `wrangler d1 execute`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { SERVICE_STATE, SERVICE_TOWNS } from '../src/data/taxonomy';
import { mapSourceCategory, REFRESH_BREAKOUTS_SQL } from '../src/lib/category-rules';
import { slugify } from '../src/lib/slug';
import { wrangler } from './wrangler';

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

// ---- wrangler --------------------------------------------------------------

function d1Query<T>(sql: string): T[] {
  const out = wrangler(['d1', 'execute', 'DB', target, '--json', '--command', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }) as string;
  return (JSON.parse(out) as { results: T[] }[])[0]?.results ?? [];
}

const q = (v: string | number | null | undefined) =>
  v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`;

// ---- main ------------------------------------------------------------------

const rows: Row[] = parse(readFileSync(csvPath), { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });
console.log(`Read ${rows.length} rows from ${csvPath}`);

const aliasRows = d1Query<{ alias: string; category_id: number }>('SELECT alias, category_id FROM category_aliases');
if (!aliasRows.length) {
  console.error('No category aliases in the database. Run `npm run seed:categories:local` (or :remote) first.');
  process.exit(1);
}
const aliases = new Map(aliasRows.map((r) => [r.alias, r.category_id]));
const parentOf = new Map(
  d1Query<{ id: number; parent_id: number | null }>('SELECT id, parent_id FROM categories').map((r) => [r.id, r.parent_id]),
);
const existingListings = d1Query<{ slug: string; source_place_id: string | null }>('SELECT slug, source_place_id FROM listings');
const slugByPlace = new Map(existingListings.filter((r) => r.source_place_id).map((r) => [r.source_place_id!, r.slug]));
const takenSlugs = new Set(existingListings.map((r) => r.slug));
const serviceTown = new Map(SERVICE_TOWNS.map((t) => [t.toLowerCase(), t]));

const statements: string[] = [];
const skipped = new Map<string, string[]>(); // reason -> example labels
const unmapped = new Map<string, { rows: number; example: string }>();
const seenPlaces = new Set<string>();
const skip = (reason: string, label: string) => skipped.set(reason, [...(skipped.get(reason) ?? []), label]);

for (const [i, row] of rows.entries()) {
  const name = val(row, 'name');
  const placeId = val(row, 'place_id', 'google_id');
  const city = val(row, 'city');
  const state = stateCode(val(row, 'us_state', 'state'));
  const label = `row ${i + 2}${name ? ` (${name}${city ? `, ${city}` : ''})` : ''}`;

  if (placeId && seenPlaces.has(placeId)) { skip('duplicate in this file', label); continue; }
  if (placeId) seenPlaces.add(placeId);
  if (val(row, 'business_status') === 'CLOSED_PERMANENTLY') { skip('permanently closed', label); continue; }
  if (!name || !city || !state) { skip('missing name, city, or state', label); continue; }
  const town = state === SERVICE_STATE ? serviceTown.get(city.toLowerCase()) : undefined;
  if (!town) { skip(`outside the service towns (${city}, ${state})`, label); continue; }

  const mapped = mapSourceCategory([val(row, 'category', 'type'), ...(val(row, 'subtypes')?.split(',') ?? [])], aliases);
  if (!('categoryId' in mapped)) {
    const key = mapped.unmapped ?? '(no category)';
    const u = unmapped.get(key) ?? { rows: 0, example: name };
    u.rows++;
    unmapped.set(key, u);
    continue;
  }

  // Imports file on the parent only; a subcategory is the owner's choice (paid plans, Linear LA-190).
  const categoryId = parentOf.get(mapped.categoryId) ?? mapped.categoryId;

  let slug = placeId ? slugByPlace.get(placeId) : undefined;
  if (!slug) {
    const base = slugify(`${name} ${town}`);
    slug = base;
    for (let n = 2; takenSlugs.has(slug); n++) slug = `${base}-${n}`;
    takenSlugs.add(slug);
    if (placeId) slugByPlace.set(placeId, slug);
  }

  const lat = Number(val(row, 'latitude'));
  const lng = Number(val(row, 'longitude'));
  const fields = {
    slug: q(slug),
    name: q(name),
    category_id: String(categoryId),
    town_id: `(SELECT id FROM towns WHERE slug = ${q(slugify(town))})`,
    address: q(val(row, 'full_address', 'address')),
    phone: q(val(row, 'phone', 'phone_1')),
    website: q(val(row, 'site', 'website')),
    email: q(val(row, 'email', 'email_1')),
    description: q(val(row, 'description', 'about')),
    lat: Number.isFinite(lat) && lat !== 0 ? String(lat) : 'NULL',
    lng: Number.isFinite(lng) && lng !== 0 ? String(lng) : 'NULL',
    source_place_id: q(placeId),
  };
  const cols = Object.keys(fields);
  // Source fields only, and only while unclaimed: an owner's edits are never overwritten.
  const refresh = cols
    .filter((c) => !['slug', 'source_place_id'].includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .concat('updated_at = unixepoch()')
    .join(', ');
  const conflict = placeId
    ? `ON CONFLICT(source_place_id) DO UPDATE SET ${refresh} WHERE listings.owner_user_id IS NULL`
    : 'ON CONFLICT(slug) DO NOTHING';
  statements.push(`INSERT INTO listings (${cols.join(', ')}, status, tier) VALUES (${Object.values(fields).join(', ')}, 'published', 'free') ${conflict};`);
}

const sql = [
  ...SERVICE_TOWNS.map((t) => `INSERT INTO towns (slug, name, state) VALUES (${q(slugify(t))}, ${q(t)}, ${q(SERVICE_STATE)}) ON CONFLICT(slug) DO NOTHING;`),
  ...statements,
  ...[...unmapped].map(([cat, u]) =>
    `INSERT INTO import_unmapped (source_category, rows, example, last_seen) VALUES (${q(cat)}, ${u.rows}, ${q(u.example)}, unixepoch()) ` +
    `ON CONFLICT(source_category) DO UPDATE SET rows = excluded.rows, example = excluded.example, last_seen = excluded.last_seen;`),
  `${REFRESH_BREAKOUTS_SQL};`,
].join('\n');
writeFileSync(outPath, sql + '\n');

const unmappedRows = [...unmapped.values()].reduce((n, u) => n + u.rows, 0);
const skippedRows = [...skipped.values()].reduce((n, l) => n + l.length, 0);
console.log(`Listings imported or refreshed: ${statements.length}, unmapped: ${unmappedRows}, skipped: ${skippedRows}`);
for (const [reason, labels] of skipped) {
  console.log(`  skipped ${labels.length} × ${reason}${labels.length > 3 ? `, e.g. ${labels.slice(0, 3).join('; ')}` : `: ${labels.join('; ')}`}`);
}
if (unmapped.size) {
  console.log(`  unmapped categories (add aliases in src/data/taxonomy.ts, re-seed categories, re-run this import):`);
  for (const [cat, u] of [...unmapped].sort((a, b) => b[1].rows - a[1].rows)) console.log(`    ${u.rows} × ${cat} (e.g. ${u.example})`);
}

wrangler(['d1', 'execute', 'DB', target, '--file', outPath, ...(target === '--remote' ? ['--yes'] : [])]);
