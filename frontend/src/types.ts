// Mirrors the backend's response shapes (backend/src/analytics.ts).

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

// Mirrors backend/src/pagination.ts's Page<T> envelope, used by /sessions
// and /anomalies.
export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
