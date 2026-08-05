import { isValidIsoTimestamp } from './csvParser';
import { HttpError } from './errors';

export interface TimeRange {
  startMs?: number;
  endMs?: number;
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
