import type { AnomalyEvent, Page, SessionSummary, TrendPair, UserSummary } from './types';

/** Requests are relative paths, proxied to the backend by Vite's dev server config. */
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body !== null && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export function fetchUserSummary(params: {
  userId: number;
  startTime?: string;
  endTime?: string;
}): Promise<UserSummary> {
  const qs = new URLSearchParams({ user_id: String(params.userId) });
  if (params.startTime) qs.set('start_time', params.startTime);
  if (params.endTime) qs.set('end_time', params.endTime);
  return getJson<UserSummary>(`/summary?${qs.toString()}`);
}

export function fetchActionTrends(params: { startTime?: string; endTime?: string }): Promise<TrendPair[]> {
  const qs = new URLSearchParams();
  if (params.startTime) qs.set('start_time', params.startTime);
  if (params.endTime) qs.set('end_time', params.endTime);
  const query = qs.toString();
  return getJson<TrendPair[]>(`/action_trends${query ? `?${query}` : ''}`);
}

// Phase 3: /sessions returns a paginated envelope, not a bare array. No
// pagination UI yet (Phase 6), so callers currently just read `.items`.
export function fetchSessions(params: {
  userId: number;
  startTime?: string;
  endTime?: string;
}): Promise<Page<SessionSummary>> {
  const qs = new URLSearchParams({ user_id: String(params.userId) });
  if (params.startTime) qs.set('start_time', params.startTime);
  if (params.endTime) qs.set('end_time', params.endTime);
  return getJson<Page<SessionSummary>>(`/sessions?${qs.toString()}`);
}

// Same envelope as /sessions, per the Phase 3 decision to keep sibling list
// endpoints consistent.
export function fetchAnomalies(params: {
  userId: number;
  startTime?: string;
  endTime?: string;
}): Promise<Page<AnomalyEvent>> {
  const qs = new URLSearchParams({ user_id: String(params.userId) });
  if (params.startTime) qs.set('start_time', params.startTime);
  if (params.endTime) qs.set('end_time', params.endTime);
  return getJson<Page<AnomalyEvent>>(`/anomalies?${qs.toString()}`);
}
