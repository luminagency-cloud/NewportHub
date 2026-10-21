import { and, asc, count, eq, sql } from 'drizzle-orm';
import { categories, categoryAliases, importUnmapped, listings, pendingEdits, retiredSlugs, towns, type Category } from '../db/schema';
import { refreshBreakouts } from './categories';
import { isIconKey } from './category-icons';
import { aliasKey } from './category-rules';
import { db } from './db';
import { placeSlugProblem, slugify } from './slug';

type Result = { ok: string } | { error: string };
type SaveResult = { id: number; ok: string } | { error: string };

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

/** Why `slug` cannot go to this category or town, or null. Categories and towns share one URL level. */
async function slugClash(slug: string, self: { categoryId?: number; townId?: number }): Promise<string | null> {
  const problem = placeSlugProblem(slug);
  if (problem) return problem;
  const [[c], [t]] = await Promise.all([
    db().select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.slug, slug)),
    db().select({ id: towns.id, name: towns.name }).from(towns).where(eq(towns.slug, slug)),
  ]);
  if (c && c.id !== self.categoryId) return `/${slug}/ is already the category “${c.name}”.`;
  if (t && t.id !== self.townId) return `/${slug}/ is already the town “${t.name}”.`;
  return null;
}

/** A live category or town takes `slug`: an old redirect on it is dropped. */
const unretire = (slug: string) => db().delete(retiredSlugs).where(eq(retiredSlugs.slug, slug));

/** `slug` is no longer used. It 301-redirects to the target, or is a 404 when there is none. */
const retire = (slug: string, target: { categoryId: number | null } | { townId: number | null }) => {
  const set = { categoryId: null, townId: null, ...target };
  return db().insert(retiredSlugs).values({ slug, ...set }).onConflictDoUpdate({ target: retiredSlugs.slug, set });
};

const SLUG_TRIGGER_ERROR = 'That URL name clashes with a town, a category, or a reserved address.';

// ---------------------------------------------------------------- categories

export async function categoryDetail(id: number) {
  const category = (await db().select().from(categories).where(eq(categories.id, id)).limit(1))[0];
  if (!category) return undefined;
  const [parent, subs, byStatus, aliases, redirects, edits] = await Promise.all([
    category.parentId ? db().select().from(categories).where(eq(categories.id, category.parentId)).then((r) => r[0]) : undefined,
    db().select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.parentId, id)).orderBy(asc(categories.name)),
    db().select({ status: listings.status, n: count() }).from(listings).where(eq(listings.categoryId, id)).groupBy(listings.status),
    db().select({ alias: categoryAliases.alias }).from(categoryAliases).where(eq(categoryAliases.categoryId, id)).orderBy(asc(categoryAliases.alias)),
    db().select({ slug: retiredSlugs.slug }).from(retiredSlugs).where(eq(retiredSlugs.categoryId, id)).orderBy(asc(retiredSlugs.slug)),
    openEditsFor('categoryId', id),
  ]);
  const listingCounts = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Partial<Record<string, number>>;
  const listingTotal = byStatus.reduce((n, r) => n + r.n, 0);
  return { category, parent, subs, listingCounts, listingTotal, aliases: aliases.map((a) => a.alias), redirects: redirects.map((r) => r.slug), openEdits: edits };
}

/** Open owner edits that would set this category or town on approval. */
async function openEditsFor(key: 'categoryId' | 'townId', id: number) {
  const [row] = await db()
    .select({ n: count() })
    .from(pendingEdits)
    .where(and(eq(pendingEdits.status, 'pending'), sql`json_extract(${pendingEdits.changes}, ${`$.${key}`}) = ${id}`));
  return row?.n ?? 0;
}

/** Add (id null) or edit a category from the admin form: name, URL name, intro text, parent. */
export async function saveCategory(id: number | null, form: FormData): Promise<SaveResult> {
  const current = id ? (await db().select().from(categories).where(eq(categories.id, id)).limit(1))[0] : undefined;
  if (id && !current) return { error: 'That category no longer exists.' };

  const name = text(form, 'name');
  if (!name || name.length > 80) return { error: 'Enter a name (up to 80 characters).' };
  const slug = text(form, 'slug') || slugify(name);
  const description = text(form, 'description') || null;
  if (description && description.length > 500) return { error: 'Keep the intro text under 500 characters.' };
  const parentId = Number(form.get('parentId')) || null;
  const iconField = text(form, 'icon');
  if (iconField && !isIconKey(iconField)) return { error: 'Choose an icon from the list.' };
  const icon = iconField || null;

  if (parentId) {
    const parent = (await db().select().from(categories).where(eq(categories.id, parentId)).limit(1))[0];
    if (!parent || parent.parentId !== null || parent.id === id) return { error: 'Choose a top-level category as the parent.' };
    if (id && (await hasSubcategories(id))) return { error: 'This category has subcategories. Move or merge them before putting it under a parent.' };
  }
  const clash = await slugClash(slug, { categoryId: id ?? undefined });
  if (clash) return { error: clash };

  try {
    if (!current) {
      const [, inserted] = await db().batch([
        unretire(slug),
        db().insert(categories).values({ name, slug, description, parentId, icon }).returning({ id: categories.id }),
      ]);
      if (parentId) await refreshBreakouts();
      return { id: inserted[0]!.id, ok: `Added “${name}”.` };
    }
    const slugChanged = slug !== current.slug;
    await db().batch([
      db()
        .update(categories)
        .set({ name, slug, description, parentId, icon, brokenOut: parentId === null ? false : current.brokenOut })
        .where(eq(categories.id, current.id)),
      ...(slugChanged ? [unretire(slug), retire(current.slug, { categoryId: current.id })] : []),
    ]);
    if (parentId !== current.parentId) await refreshBreakouts();
    return { id: current.id, ok: slugChanged ? `Saved. /${current.slug}/ now redirects to /${slug}/.` : 'Saved.' };
  } catch {
    return { error: SLUG_TRIGGER_ERROR };
  }
}

async function hasSubcategories(id: number) {
  const [row] = await db().select({ n: count() }).from(categories).where(eq(categories.parentId, id));
  return (row?.n ?? 0) > 0;
}

/**
 * Move everything from one category into another and delete the first: listings, import aliases,
 * open owner edits, and old URLs. Its URL 301-redirects to the target.
 */
export async function mergeCategory(fromId: number, intoId: number): Promise<Result> {
  if (!intoId || fromId === intoId) return { error: 'Choose another category to merge into.' };
  const [from, into] = await Promise.all([getCategoryRow(fromId), getCategoryRow(intoId)]);
  if (!from || !into) return { error: 'That category no longer exists.' };
  if (await hasSubcategories(fromId)) return { error: `“${from.name}” has subcategories. Move or merge them first.` };

  const [moved] = await db().select({ n: count() }).from(listings).where(eq(listings.categoryId, fromId));
  await db().batch([
    db().update(listings).set({ categoryId: intoId, updatedAt: new Date() }).where(eq(listings.categoryId, fromId)),
    db().update(categoryAliases).set({ categoryId: intoId }).where(eq(categoryAliases.categoryId, fromId)),
    db()
      .update(pendingEdits)
      .set({ changes: sql`json_set(${pendingEdits.changes}, '$.categoryId', ${intoId})` })
      .where(and(eq(pendingEdits.status, 'pending'), sql`json_extract(${pendingEdits.changes}, '$.categoryId') = ${fromId}`)),
    db().update(retiredSlugs).set({ categoryId: intoId }).where(eq(retiredSlugs.categoryId, fromId)),
    db().delete(categories).where(eq(categories.id, fromId)),
    retire(from.slug, { categoryId: intoId }),
  ]);
  await refreshBreakouts();
  return { ok: `Merged “${from.name}” into “${into.name}” (${moved?.n ?? 0} businesses moved). /${from.slug}/ now redirects to /${into.slug}/.` };
}

/** Delete a category with no listings, no subcategories, and no open owner edits pointing at it. */
export async function deleteCategory(id: number): Promise<Result> {
  const d = await categoryDetail(id);
  if (!d) return { error: 'That category no longer exists.' };
  if (d.listingTotal > 0) return { error: `“${d.category.name}” still has ${d.listingTotal} business(es). Merge it instead.` };
  if (d.subs.length) return { error: `“${d.category.name}” has subcategories. Move or merge them first.` };
  if (d.openEdits) return { error: 'An owner edit waiting in Moderation uses this category. Deal with it first.' };
  const target = d.category.parentId;
  await db().batch([
    db().update(retiredSlugs).set({ categoryId: target }).where(eq(retiredSlugs.categoryId, id)),
    db().delete(categories).where(eq(categories.id, id)),
    retire(d.category.slug, { categoryId: target }),
  ]);
  return { ok: `Deleted “${d.category.name}”.${target && d.parent ? ` /${d.category.slug}/ now redirects to /${d.parent.slug}/.` : ''}` };
}

const getCategoryRow = (id: number): Promise<Category | undefined> =>
  db().select().from(categories).where(eq(categories.id, id)).limit(1).then((r) => r[0]);

// ---------------------------------------------------------------- import aliases

/**
 * Map a source category name (as Outscraper writes it) to one of ours, or re-point an existing
 * mapping. Matching unmapped-import rows are cleared; the import must be re-run to bring them in.
 */
export async function saveAlias(source: string, categoryId: number): Promise<Result> {
  const key = aliasKey(source);
  if (!key || key.length > 120) return { error: 'Enter the source category name.' };
  const category = await getCategoryRow(categoryId);
  if (!category) return { error: 'Choose a category.' };
  const unmapped = (await db().select({ source: importUnmapped.sourceCategory }).from(importUnmapped)).filter((u) => aliasKey(u.source) === key);
  await db().batch([
    db().insert(categoryAliases).values({ alias: key, categoryId }).onConflictDoUpdate({ target: categoryAliases.alias, set: { categoryId } }),
    ...unmapped.map((u) => db().delete(importUnmapped).where(eq(importUnmapped.sourceCategory, u.source))),
  ]);
  return { ok: `“${key}” now imports into “${category.name}”.${unmapped.length ? ' Re-run the import to bring in those businesses.' : ''}` };
}

export async function deleteAlias(alias: string): Promise<{ ok: string }> {
  await db().delete(categoryAliases).where(eq(categoryAliases.alias, alias));
  return { ok: `Removed “${alias}”. If it is in src/data/taxonomy.ts, the next category seed adds it back; re-point it instead to keep it out.` };
}

// ---------------------------------------------------------------- towns

export async function townsWithCounts() {
  return db()
    .select({
      id: towns.id, slug: towns.slug, name: towns.name, state: towns.state,
      published: sql<number>`count(case when ${listings.status} = 'published' then 1 end)`,
      total: count(listings.id),
    })
    .from(towns)
    .leftJoin(listings, eq(listings.townId, towns.id))
    .groupBy(towns.id)
    .orderBy(asc(towns.name));
}

export async function townDetail(id: number) {
  const town = (await db().select().from(towns).where(eq(towns.id, id)).limit(1))[0];
  if (!town) return undefined;
  const [byStatus, redirects, edits] = await Promise.all([
    db().select({ status: listings.status, n: count() }).from(listings).where(eq(listings.townId, id)).groupBy(listings.status),
    db().select({ slug: retiredSlugs.slug }).from(retiredSlugs).where(eq(retiredSlugs.townId, id)).orderBy(asc(retiredSlugs.slug)),
    openEditsFor('townId', id),
  ]);
  const listingCounts = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Partial<Record<string, number>>;
  return { town, listingCounts, listingTotal: byStatus.reduce((n, r) => n + r.n, 0), redirects: redirects.map((r) => r.slug), openEdits: edits };
}

/** Add (id null) or edit a town: name, URL name, state. */
export async function saveTown(id: number | null, form: FormData): Promise<SaveResult> {
  const current = id ? (await db().select().from(towns).where(eq(towns.id, id)).limit(1))[0] : undefined;
  if (id && !current) return { error: 'That town no longer exists.' };
  const name = text(form, 'name');
  if (!name || name.length > 80) return { error: 'Enter a name (up to 80 characters).' };
  const slug = text(form, 'slug') || slugify(name);
  const state = text(form, 'state').toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return { error: 'The state is a two-letter code, e.g. RI.' };
  const clash = await slugClash(slug, { townId: id ?? undefined });
  if (clash) return { error: clash };

  try {
    if (!current) {
      const [, inserted] = await db().batch([unretire(slug), db().insert(towns).values({ name, slug, state }).returning({ id: towns.id })]);
      return { id: inserted[0]!.id, ok: `Added “${name}”.` };
    }
    const slugChanged = slug !== current.slug;
    await db().batch([
      db().update(towns).set({ name, slug, state }).where(eq(towns.id, current.id)),
      ...(slugChanged ? [unretire(slug), retire(current.slug, { townId: current.id })] : []),
    ]);
    return { id: current.id, ok: slugChanged ? `Saved. /${current.slug}/ now redirects to /${slug}/.` : 'Saved.' };
  } catch {
    return { error: SLUG_TRIGGER_ERROR };
  }
}

/** Move a town's listings, open owner edits, and old URLs into another town, then delete it. */
export async function mergeTown(fromId: number, intoId: number): Promise<Result> {
  if (!intoId || fromId === intoId) return { error: 'Choose another town to merge into.' };
  const [[from], [into]] = await Promise.all([
    db().select().from(towns).where(eq(towns.id, fromId)),
    db().select().from(towns).where(eq(towns.id, intoId)),
  ]);
  if (!from || !into) return { error: 'That town no longer exists.' };
  const [moved] = await db().select({ n: count() }).from(listings).where(eq(listings.townId, fromId));
  await db().batch([
    db().update(listings).set({ townId: intoId, updatedAt: new Date() }).where(eq(listings.townId, fromId)),
    db()
      .update(pendingEdits)
      .set({ changes: sql`json_set(${pendingEdits.changes}, '$.townId', ${intoId})` })
      .where(and(eq(pendingEdits.status, 'pending'), sql`json_extract(${pendingEdits.changes}, '$.townId') = ${fromId}`)),
    db().update(retiredSlugs).set({ townId: intoId }).where(eq(retiredSlugs.townId, fromId)),
    db().delete(towns).where(eq(towns.id, fromId)),
    retire(from.slug, { townId: intoId }),
  ]);
  return { ok: `Merged “${from.name}” into “${into.name}” (${moved?.n ?? 0} businesses moved). /${from.slug}/ now redirects to /${into.slug}/.` };
}

/** Delete a town with no listings and no open owner edits pointing at it. Its URL becomes a 404. */
export async function deleteTown(id: number): Promise<Result> {
  const d = await townDetail(id);
  if (!d) return { error: 'That town no longer exists.' };
  if (d.listingTotal > 0) return { error: `“${d.town.name}” still has ${d.listingTotal} business(es). Merge it instead.` };
  if (d.openEdits) return { error: 'An owner edit waiting in Moderation uses this town. Deal with it first.' };
  await db().batch([db().delete(towns).where(eq(towns.id, id)), retire(d.town.slug, { townId: null })]);
  return { ok: `Deleted “${d.town.name}”.` };
}
