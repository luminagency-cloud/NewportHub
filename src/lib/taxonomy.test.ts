import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_TOWNS, TAXONOMY } from '../data/taxonomy.ts';
import { aliasKey } from './category-rules.ts';
import { isIconKey } from './category-icons.ts';
import { RESERVED_SLUGS, slugify } from './slug.ts';

test('every alias maps to exactly one category', () => {
  const seen = new Map<string, string>();
  for (const p of TAXONOMY) {
    for (const [owner, aliases] of [[p.name, p.aliases] as const, ...p.subs.map((s) => [s.name, s.aliases] as const)]) {
      for (const a of aliases) {
        const k = aliasKey(a);
        assert.ok(!seen.has(k), `alias "${a}" is on both "${seen.get(k)}" and "${owner}"`);
        seen.set(k, owner);
      }
    }
  }
});

test('category slugs are unique and do not clash with towns or reserved routes', () => {
  const towns = new Set(SERVICE_TOWNS.map(slugify));
  const slugs = new Set<string>();
  for (const name of TAXONOMY.flatMap((p) => [p.name, ...p.subs.map((s) => s.name)])) {
    const s = slugify(name);
    assert.ok(s, `empty slug for "${name}"`);
    assert.ok(!slugs.has(s), `duplicate slug "${s}"`);
    assert.ok(!towns.has(s) && !RESERVED_SLUGS.has(s), `slug "${s}" clashes with a town or route`);
    slugs.add(s);
  }
});

test('every search term maps somewhere, so searched businesses are not all unmapped', () => {
  const keys = new Set(TAXONOMY.flatMap((p) => [...p.aliases, ...p.subs.flatMap((s) => s.aliases)]).map(aliasKey));
  for (const term of TAXONOMY.flatMap((p) => p.search)) assert.ok(keys.has(aliasKey(term)), `search term "${term}" has no alias`);
});

test('every parent has a known icon', () => {
  for (const p of TAXONOMY) assert.ok(isIconKey(p.icon), `"${p.name}" has unknown icon "${p.icon}"`);
});
