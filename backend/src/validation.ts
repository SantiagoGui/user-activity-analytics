import { isValidIsoTimestamp } from './shared/time';
import { HttpError } from './errors';
import type { BucketSize } from 'activity-analytics-shared-types';
import {
  DEFAULT_ACTION_TRENDS_LIMIT,
  DEFAULT_BUCKET,
  DEFAULT_PAGE_SIZE,
  MAX_ACTION_TRENDS_LIMIT,
  MAX_PAGE_SIZE,
} from './config';

export interface TimeRange {
  startMs?: number;
  endMs?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

function firstValue(v: unknown): string | undefined {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : undefined;
  return typeof v === 'string' ? v : undefined;
}

/** Parses optional start_time/end_time query params. Throws 400 on invalid format or start > end. */
export function parseTimeRange(query: Record<string, unknown>): TimeRange {
  const startRaw = firstValue(query.start_time);
  const endRaw = firstValue(query.end_time);

  let startMs: number | undefined;
  let endMs: number | undefined;

  if (startRaw !== undefined && startRaw !== '') {
    if (!isValidIsoTimestamp(startRaw)) {
      throw new HttpError(400, `Invalid start_time "${startRaw}", expected ISO 8601 e.g. 2024-01-01T00:00:00Z`);
    }
    startMs = Date.parse(startRaw);
  }
  if (endRaw !== undefined && endRaw !== '') {
    if (!isValidIsoTimestamp(endRaw)) {
      throw new HttpError(400, `Invalid end_time "${endRaw}", expected ISO 8601 e.g. 2024-01-01T00:00:00Z`);
    }
    endMs = Date.parse(endRaw);
  }

  if (startMs !== undefined && endMs !== undefined && startMs > endMs) {
    throw new HttpError(400, 'start_time must not be after end_time');
  }

  return { startMs, endMs };
}

/** Parses the required user_id query param. Throws 400 if missing or not an integer. */
export function parseRequiredUserId(query: Record<string, unknown>): number {
  const raw = firstValue(query.user_id);
  if (raw === undefined || raw === '') {
    throw new HttpError(400, 'user_id is required');
  }
  const userId = Number(raw);
  if (!Number.isInteger(userId)) {
    throw new HttpError(400, `Invalid user_id "${raw}", expected an integer`);
  }
  return userId;
}

/** Parses optional page/page_size query params for /sessions and /anomalies.
 *  page defaults to 1, page_size to DEFAULT_PAGE_SIZE. Both must be positive
 *  integers (400 otherwise); page_size above MAX_PAGE_SIZE is clamped rather
 *  than rejected, matching parseLimit's "validated vs. capped" split below. */
export function parsePagination(query: Record<string, unknown>): Pagination {
  const pageRaw = firstValue(query.page);
  const pageSizeRaw = firstValue(query.page_size);

  let page = 1;
  if (pageRaw !== undefined && pageRaw !== '') {
    page = Number(pageRaw);
    if (!Number.isInteger(page) || page < 1) {
      throw new HttpError(400, `Invalid page "${pageRaw}", expected a positive integer`);
    }
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  if (pageSizeRaw !== undefined && pageSizeRaw !== '') {
    pageSize = Number(pageSizeRaw);
    if (!Number.isInteger(pageSize) || pageSize < 1) {
      throw new HttpError(400, `Invalid page_size "${pageSizeRaw}", expected a positive integer`);
    }
    pageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  }

  return { page, pageSize };
}

/** Parses the optional limit query param for /action_trends. Defaults to
 *  DEFAULT_ACTION_TRENDS_LIMIT; invalid values are a 400, values above
 *  MAX_ACTION_TRENDS_LIMIT are silently capped rather than rejected. */
export function parseLimit(query: Record<string, unknown>): number {
  const raw = firstValue(query.limit);
  if (raw === undefined || raw === '') {
    return DEFAULT_ACTION_TRENDS_LIMIT;
  }
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new HttpError(400, `Invalid limit "${raw}", expected a positive integer`);
  }
  return Math.min(limit, MAX_ACTION_TRENDS_LIMIT);
}

const BUCKET_SIZES: readonly BucketSize[] = ['day', 'week', 'month'];

/** Parses the optional bucket query param for /overview. Defaults to
 *  DEFAULT_BUCKET. Unlike parseLimit/parsePagination there is nothing to clamp —
 *  the value is an enum, so anything unrecognised is a 400. */
export function parseBucket(query: Record<string, unknown>): BucketSize {
  const raw = firstValue(query.bucket);
  if (raw === undefined || raw === '') {
    return DEFAULT_BUCKET;
  }
  const match = BUCKET_SIZES.find((size) => size === raw);
  if (!match) {
    throw new HttpError(400, `Invalid bucket "${raw}", expected one of: ${BUCKET_SIZES.join(', ')}`);
  }
  return match;
}
