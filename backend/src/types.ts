// Shared types for the activity log domain.

/** The 3 base actions carry only page+duration; search/download/upload add one field each. */
export interface ActivityMetadata {
  page: string;
  duration: number;
  query?: string;
  file_type?: string;
  file_size?: number;
}

export interface ActivityEvent {
  userId: number;
  timestamp: string; // original ISO 8601 string, kept for output
  timestampMs: number; // parsed epoch ms, used for sorting/range queries
  action: string;
  metadata: ActivityMetadata;
}

export interface LoadResult {
  totalLines: number;
  loaded: number;
  skipped: number;
  skippedReasons: string[]; // capped sample of reasons, for diagnostics
}

export interface ApiError {
  error: string;
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
