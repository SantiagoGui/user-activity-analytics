export const ACTIVITIES_CSV_URL =
  'https://cdn.prod.website-files.com/634d5c356b8adeff5a7c6393/6884a1f50007bdc0d663422c_activities.csv';

export const PORT = Number(process.env.PORT ?? 4000);

export const EXPECTED_CSV_HEADER = ['user_id', 'timestamp', 'action', 'metadata'];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const DEFAULT_ACTION_TRENDS_LIMIT = 3;
export const MAX_ACTION_TRENDS_LIMIT = 50;
