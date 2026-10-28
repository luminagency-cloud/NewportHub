import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

const migrationsDir = new URL('../../drizzle/migrations/', import.meta.url);

function statements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function migrationFiles(through: string): string[] {
  return readdirSync(migrationsDir)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name) && name <= through)
    .sort();
}

/** Apply each statement in its own transaction, which is how D1 runs a migration file. */
function applyMigration(db: DatabaseSync, name: string) {
  const sql = readFileSync(new URL(name, migrationsDir), 'utf8');
  for (const statement of statements(sql)) db.exec(statement);
}

function freshDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const name of migrationFiles('0010_category_icons.sql')) applyMigration(db, name);
  db.exec(`
    INSERT INTO towns (id, slug, name, state) VALUES (1, 'newport', 'Newport', 'RI');
    INSERT INTO categories (id, slug, name) VALUES (1, 'restaurants', 'Restaurants');
    INSERT INTO listings (id, slug, name, category_id, town_id, tier, status) VALUES
      (1, 'harbor', 'Harbor', 1, 1, 'free', 'published'),
      (2, 'old-middle', 'Old Featured', 1, 1, 'featured', 'published'),
      (3, 'old-top', 'Old Premium', 1, 1, 'premium', 'published');
    INSERT INTO slug_redirects (old_slug, listing_id) VALUES ('harbor-old', 1);
    INSERT INTO listing_stats (listing_id, day, kind, count) VALUES (1, '2026-10-01', 'view', 7);
    INSERT INTO claims (listing_id, user_id, user_email, method, status)
      VALUES (1, 'user_1', 'owner@example.com', 'manual', 'pending');
    INSERT INTO pending_edits (listing_id, user_id, user_email, changes, status)
      VALUES (1, 'user_1', 'owner@example.com', '{}', 'pending');
    INSERT INTO listing_changes (listing_id, user_id, user_email, action, changes)
      VALUES (1, 'user_1', 'owner@example.com', 'admin edit', '{}');
  `);
  return db;
}

function rows(db: DatabaseSync, sql: string): unknown {
  return JSON.parse(JSON.stringify(db.prepare(sql).all()));
}

function count(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number };
  return row.n;
}

test('0011 keeps redirects, stats, claims, and edits while renaming tiers', () => {
  const db = freshDatabase();
  applyMigration(db, '0011_plan_tiers.sql');

  assert.deepEqual(rows(db, 'SELECT id, tier, social_url, menu_url, booking_url, photos FROM listings ORDER BY id'), [
    { id: 1, tier: 'basic', social_url: null, menu_url: null, booking_url: null, photos: null },
    { id: 2, tier: 'plus', social_url: null, menu_url: null, booking_url: null, photos: null },
    { id: 3, tier: 'featured', social_url: null, menu_url: null, booking_url: null, photos: null },
  ]);
  assert.deepEqual(rows(db, 'SELECT old_slug, listing_id FROM slug_redirects'), [{ old_slug: 'harbor-old', listing_id: 1 }]);
  assert.deepEqual(rows(db, 'SELECT listing_id, day, kind, count FROM listing_stats'), [
    { listing_id: 1, day: '2026-10-01', kind: 'view', count: 7 },
  ]);
  assert.equal(count(db, 'claims'), 1);
  assert.equal(count(db, 'pending_edits'), 1);
  assert.equal(count(db, 'listing_changes'), 1);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);

  db.exec("INSERT INTO listings (slug, name, category_id, town_id, status) VALUES ('omitted-tier', 'Omitted', 1, 1, 'pending')");
  const inserted = db.prepare("SELECT tier FROM listings WHERE slug = 'omitted-tier'").get() as { tier: string };
  assert.equal(inserted.tier, 'basic');
});
