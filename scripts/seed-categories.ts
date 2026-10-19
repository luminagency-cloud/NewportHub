/**
 * Write the category tree from src/data/taxonomy.ts to D1: parents, subcategories, and aliases.
 * Adds what is missing and never renames, moves, or deletes, so admin changes survive a re-run.
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
const idOf = (slug: string) => `(SELECT id FROM categories WHERE slug = ${q(slug)})`;

const out: string[] = [];
let subs = 0;
let aliases = 0;
for (const p of TAXONOMY) {
  const ps = slugify(p.name);
  out.push(`INSERT INTO categories (slug, name) VALUES (${q(ps)}, ${q(p.name)}) ON CONFLICT(slug) DO NOTHING;`);
  for (const a of p.aliases) {
    out.push(`INSERT INTO category_aliases (alias, category_id) VALUES (${q(aliasKey(a))}, ${idOf(ps)}) ON CONFLICT(alias) DO NOTHING;`);
    aliases++;
  }
  for (const s of p.subs) {
    const ss = slugify(s.name);
    out.push(`INSERT INTO categories (slug, name, parent_id) VALUES (${q(ss)}, ${q(s.name)}, ${idOf(ps)}) ON CONFLICT(slug) DO NOTHING;`);
    subs++;
    for (const a of s.aliases) {
      out.push(`INSERT INTO category_aliases (alias, category_id) VALUES (${q(aliasKey(a))}, ${idOf(ss)}) ON CONFLICT(alias) DO NOTHING;`);
      aliases++;
    }
  }
}
out.push(`${REFRESH_BREAKOUTS_SQL};`);
writeFileSync('data/categories.sql', out.join('\n') + '\n');
console.log(`Parents: ${TAXONOMY.length}, subcategories: ${subs}, aliases: ${aliases}`);
wrangler(['d1', 'execute', 'DB', target, '--file', 'data/categories.sql', ...(target === '--remote' ? ['--yes'] : [])]);
