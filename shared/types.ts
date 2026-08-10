// The API response shapes both packages depend on. Backend defines these by
// building them (see backend/src/analytics.ts, pagination.ts); frontend
// consumes the same JSON shape over the wire. Kept here instead of
// hand-mirrored in both packages so a field rename can't silently drift.

export interface UserSummary {
  user_id: number;
  total_actions: number;
  most_frequent_action: string;
  avg_duration: number;
  most_frequent_page: string;
}

export interface TrendPair {
  user_id: number;
  action: string;
  count: number;
}

export interface SessionSummary {
  start: string;
  end: string;
  actions: number;
  total_duration: number;
}

export interface AnomalyEvent {
  timestamp: string;
  action: string;
  duration: number;
}

// GET /users — powers the frontend's user autocomplete.
export interface UserCount {
  user_id: number;
  count: number;
}

// Envelope for /sessions and /anomalies (see backend/src/pagination.ts).
export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

// /sessions-only extension of Page<SessionSummary>: the earliest start and
// latest end across the *full* session list for the query, not just the
// current page — lets the frontend draw a timeline axis that stays fixed as
// you paginate (see docs/design.md's "Signature: the session timeline").
// Null when there are no sessions in range.
export interface SessionsPage extends Page<SessionSummary> {
  range_start: string | null;
  range_end: string | null;
}

// Time-bucket granularity for GET /overview's activity series.
export type BucketSize = 'day' | 'week' | 'month';

// GET /overview — describes the dataset (or a time slice of it) rather than one
// user. See docs/superpowers/specs/2026-08-10-overview-product-design.md.
export interface ActivityBucket {
  bucket_start: string;
  count: number;
}

export interface ActionCount {
  action: string;
  count: number;
}

export interface Overview {
  total_events: number;
  total_users: number;
  distinct_actions: number;
  // Bounds of the events *within the requested range*, null when it's empty.
  // The full dataset's bounds live on /health, which is filter-independent.
  range_start: string | null;
  range_end: string | null;
  bucket: BucketSize;
  activity: ActivityBucket[];
  top_actions: ActionCount[];
  top_users: UserCount[];
}

// GET /users — powers the user list. `activity` is a fixed-length series across
// the *dataset* bounds, not the current filter, so a user's shape stays
// recognisable as you change the range.
export interface UserListEntry extends UserCount {
  activity: number[];
}

// GET /health — load state plus the dataset's own bounds, which the UI uses to
// clamp its date inputs. Filter-independent by definition; /overview's
// range_start/range_end describe a filtered slice and are not interchangeable.
export interface Health {
  loaded: boolean;
  total_lines: number | null;
  rows_loaded: number | null;
  rows_skipped: number | null;
  skipped_reasons: string[] | null;
  dataset_start: string | null;
  dataset_end: string | null;
}
