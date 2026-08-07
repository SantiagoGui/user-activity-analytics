// Re-exports the API response shapes from the shared package instead of
// hand-mirroring the backend's types.ts/analytics.ts/pagination.ts — a field
// rename on one side now fails the other side's typecheck instead of
// silently drifting.
export type {
  UserSummary,
  TrendPair,
  SessionSummary,
  AnomalyEvent,
  Page,
  SessionsPage,
  UserCount,
} from 'activity-analytics-shared-types';
