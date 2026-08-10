import type {
  AnomalyEvent,
  BucketSize,
  Health,
  Overview,
  Page,
  SessionsPage,
  TrendPair,
  UserListEntry,
  UserSummary,
} from './types';

/**
 * Requests are relative paths, proxied to the backend by Vite's dev server
 * config. Both failure paths get copy that names the problem and what to do
 * about it (docs/design.md's Copy section), instead of a raw browser message
 * ("Failed to fetch") or a bare status code.
 */
async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body !== null && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : 'The server had a problem. Try again.';
    throw new Error(message);
  }
  return body as T;
}

/** Drops undefined/empty entries; everything else becomes a query param. */
function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  return qs.toString();
}

/** Powers the User field's autocomplete. */
export function fetchUsers(signal?: AbortSignal): Promise<UserListEntry[]> {
  return getJson<UserListEntry[]>('/users', signal);
}

export function fetchOverview(
  params: { startTime?: string; endTime?: string; bucket?: BucketSize },
  signal?: AbortSignal,
): Promise<Overview> {
  const query = buildQuery({ start_time: params.startTime, end_time: params.endTime, bucket: params.bucket });
  return getJson<Overview>(`/overview${query ? `?${query}` : ''}`, signal);
}

export function fetchHealth(signal?: AbortSignal): Promise<Health> {
  return getJson<Health>('/health', signal);
}

export function fetchUserSummary(
  params: { userId: number; startTime?: string; endTime?: string },
  signal?: AbortSignal,
): Promise<UserSummary> {
  const query = buildQuery({ user_id: params.userId, start_time: params.startTime, end_time: params.endTime });
  return getJson<UserSummary>(`/summary?${query}`, signal);
}

export function fetchActionTrends(
  params: { startTime?: string; endTime?: string },
  signal?: AbortSignal,
): Promise<TrendPair[]> {
  const query = buildQuery({ start_time: params.startTime, end_time: params.endTime });
  return getJson<TrendPair[]>(`/action_trends${query ? `?${query}` : ''}`, signal);
}

// Phase 3: /sessions returns a paginated envelope, not a bare array.
export function fetchSessions(
  params: { userId: number; startTime?: string; endTime?: string; page?: number; pageSize?: number },
  signal?: AbortSignal,
): Promise<SessionsPage> {
  const query = buildQuery({
    user_id: params.userId,
    start_time: params.startTime,
    end_time: params.endTime,
    page: params.page,
    page_size: params.pageSize,
  });
  return getJson<SessionsPage>(`/sessions?${query}`, signal);
}

// Same envelope as /sessions, per the Phase 3 decision to keep sibling list
// endpoints consistent.
export function fetchAnomalies(
  params: { userId: number; startTime?: string; endTime?: string; page?: number; pageSize?: number },
  signal?: AbortSignal,
): Promise<Page<AnomalyEvent>> {
  const query = buildQuery({
    user_id: params.userId,
    start_time: params.startTime,
    end_time: params.endTime,
    page: params.page,
    page_size: params.pageSize,
  });
  return getJson<Page<AnomalyEvent>>(`/anomalies?${query}`, signal);
}
