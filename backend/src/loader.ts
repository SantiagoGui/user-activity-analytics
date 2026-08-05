import { fetchActivitiesCsv } from './fetchCsv';
import { parseActivitiesCsv } from './csvParser';
import type { ActivityStore } from './store';
import type { LoadResult } from './types';

/** Fetches + parses the CSV and swaps it into the store. Throws on failure, leaving
 *  whatever data the store already had (if any) untouched. */
export async function loadActivities(store: ActivityStore): Promise<LoadResult> {
  const csvText = await fetchActivitiesCsv();
  const { events, result } = parseActivitiesCsv(csvText);
  store.replaceData(events, result);
  return result;
}
