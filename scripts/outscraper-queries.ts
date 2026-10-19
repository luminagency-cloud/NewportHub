/**
 * Print Outscraper queries (search term × service town) from src/data/taxonomy.ts.
 *
 *   npx tsx scripts/outscraper-queries.ts            # full list
 *   npx tsx scripts/outscraper-queries.ts --test     # 4-query test run (Middletown)
 */
import { SERVICE_STATE, SERVICE_TOWNS, TAXONOMY } from '../src/data/taxonomy';

const q = (term: string, town: string) => `${term}, ${town}, ${SERVICE_STATE}, US`;
const lines = process.argv.includes('--test')
  ? ['restaurant', 'dentist', 'plumber', 'hotel'].map((t) => q(t, 'Middletown'))
  : TAXONOMY.flatMap((p) => p.search).flatMap((t) => SERVICE_TOWNS.map((town) => q(t, town)));
console.log(lines.join('\n'));
