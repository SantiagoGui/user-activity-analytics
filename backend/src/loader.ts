import { fetchActivitiesCsv } from './fetchCsv';
import { parseActivitiesCsv } from './csvParser';
import { activityStore } from './store';
import type { LoadResult } from './types';

/** Fetches + parses the CSV and swaps it into the store. Throws on failure, leaving
 *  whatever data the store already had (if any) untouched. */
export async function loadActivities(): Promise<LoadResult> {
  const csvText = await fetchActivitiesCsv();
  const { events, result } = parseActivitiesCsv(csvText);
  activityStore.replaceData(events, result);
  return result;
}
