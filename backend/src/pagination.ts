import type { Page } from 'activity-analytics-shared-types';

/**
 * Shared pagination envelope for /sessions and /anomalies. Both compute their
 * full result set for the given range first (sessions/anomalies are derived
 * aggregates, not slices of raw events, so pagination can't happen at the
 * event level) and then page over that.
 */
export function paginate<T>(all: T[], page: number, pageSize: number): Page<T> {
  const total = all.length;
  const total_pages = Math.ceil(total / pageSize) || 0;
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), page, page_size: pageSize, total, total_pages };
}
