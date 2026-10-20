/**
 * Write the category tree from src/data/taxonomy.ts to D1: parents, subcategories, and aliases.
 * Adds what is missing and never renames, moves, or deletes, so admin changes survive a re-run:
 * a slug retired in admin (renamed, merged, deleted) is not re-created, and its aliases go to
 * wherever it went. A slug a town now uses is skipped instead of failing the slug-clash trigger.
 *
 *   npx tsx scripts/seed-categories.ts --local | --remote
 */
import { writeFileSync } from 'node:fs';
import { TAXONOMY } from '../src/data/taxonomy';
import { aliasKey, REFRESH_BREAKOUTS_SQL } from '../src/lib/category-rules';
import { slugify } from '../src/lib/slug';
import { wrangler } from './wrangler';

const target = process.argv.includes('--remote') ? '--remote' : '--local';
const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
// A renamed or merged category is found through its retired slug.
const idOf = (slug: string) =>
  `COALESCE((SELECT id FROM categories WHERE slug = ${q(slug)}), (SELECT category_id FROM retired_slugs WHERE slug = ${q(slug)}))`;
const free = (slug: string) =>
  `NOT EXISTS (SELECT 1 FROM retired_slugs WHERE slug = ${q(slug)}) AND NOT EXISTS (SELECT 1 FROM towns WHERE slug = ${q(slug)})`;
const alias = (a: string, slug: string) =>
  `INSERT INTO category_aliases (alias, category_id) SELECT ${q(aliasKey(a))}, id FROM (SELECT ${idOf(slug)} AS id) WHERE id IS NOT NULL ON CONFLICT(alias) DO NOTHING;`;

const out: string[] = [];
let subs = 0;
let aliases = 0;
for (const p of TAXONOMY) {
  const ps = slugify(p.name);
  out.push(`INSERT INTO categories (slug, name) SELECT ${q(ps)}, ${q(p.name)} WHERE ${free(ps)} ON CONFLICT(slug) DO NOTHING;`);
  for (const a of p.aliases) {
    out.push(alias(a, ps));
    aliases++;
  }
  for (const s of p.subs) {
    const ss = slugify(s.name);
    // Only under a live top-level parent (a parent deleted in admin takes its missing subs with it).
    out.push(
      `INSERT INTO categories (slug, name, parent_id) SELECT ${q(ss)}, ${q(s.name)}, p.id FROM categories p ` +
        `WHERE p.id = ${idOf(ps)} AND p.parent_id IS NULL AND ${free(ss)} ON CONFLICT(slug) DO NOTHING;`,
    );
    subs++;
    for (const a of s.aliases) {
      out.push(alias(a, ss));
      aliases++;
    }
  }
}
out.push(`${REFRESH_BREAKOUTS_SQL};`);
writeFileSync('data/categories.sql', out.join('\n') + '\n');
console.log(`Parents: ${TAXONOMY.length}, subcategories: ${subs}, aliases: ${aliases}`);
wrangler(['d1', 'execute', 'DB', target, '--file', 'data/categories.sql', ...(target === '--remote' ? ['--yes'] : [])]);
