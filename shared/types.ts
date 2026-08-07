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
