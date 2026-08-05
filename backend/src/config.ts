export const ACTIVITIES_CSV_URL =
  'https://cdn.prod.website-files.com/634d5c356b8adeff5a7c6393/6884a1f50007bdc0d663422c_activities.csv';

export const PORT = Number(process.env.PORT ?? 4000);

export const EXPECTED_CSV_HEADER = ['user_id', 'timestamp', 'action', 'metadata'];
