import { ACTIVITIES_CSV_URL } from './config';

export async function fetchActivitiesCsv(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(ACTIVITIES_CSV_URL);
  } catch (err) {
    throw new Error(`Failed to fetch activities CSV: ${(err as Error).message}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch activities CSV: HTTP ${response.status}`);
  }
  return response.text();
}
