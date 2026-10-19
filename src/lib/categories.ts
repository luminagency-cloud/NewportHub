import { sql } from 'drizzle-orm';
import { REFRESH_BREAKOUTS_SQL } from './category-rules';
import { db } from './db';

/**
 * Recompute which subcategories have their own page (5 to break out, below 3 to collapse).
 * Call after anything that publishes, unpublishes, or re-categorises a listing.
 */
export async function refreshBreakouts() {
  await db().run(sql.raw(REFRESH_BREAKOUTS_SQL));
}
