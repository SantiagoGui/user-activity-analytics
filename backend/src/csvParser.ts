import { EXPECTED_CSV_HEADER } from './config';
import type { ActivityEvent, ActivityMetadata, LoadResult } from './types';

const MAX_SAMPLE_REASONS = 20;

/**
 * The `metadata` column is a raw JSON object embedded in the CSV WITHOUT quoting,
 * even though it contains commas (e.g. `72,2024-01-04T05:20:04Z,logout,{"page": "dashboard", "duration": 107}`).
 * A generic CSV parser or naive `line.split(',')` would shred it into extra columns.
 * Since only the first 3 columns (user_id, timestamp, action) are guaranteed comma-free,
 * we split on the first 3 commas only and treat everything after as the raw metadata JSON.
 * See docs/data-source.md for the full analysis this is based on.
 */
function splitDataLine(line: string): [string, string, string, string] | null {
  const parts: string[] = [];
  let rest = line;
  for (let i = 0; i < 3; i++) {
    const idx = rest.indexOf(',');
    if (idx === -1) return null;
    parts.push(rest.slice(0, idx));
    rest = rest.slice(idx + 1);
  }
  parts.push(rest);
  return parts as [string, string, string, string];
}

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function isValidIsoTimestamp(value: string): boolean {
  return ISO_TIMESTAMP_RE.test(value) && !Number.isNaN(Date.parse(value));
}

function parseMetadata(raw: string): ActivityMetadata | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.page !== 'string') return null;
  if (typeof obj.duration !== 'number' || !Number.isFinite(obj.duration)) return null;

  const metadata: ActivityMetadata = { page: obj.page, duration: obj.duration };
  if (typeof obj.query === 'string') metadata.query = obj.query;
  if (typeof obj.file_type === 'string') metadata.file_type = obj.file_type;
  if (typeof obj.file_size === 'number' && Number.isFinite(obj.file_size)) {
    metadata.file_size = obj.file_size;
  }
  return metadata;
}

/**
 * Parses the full CSV body into validated events. Invalid individual rows are skipped
 * (and counted/sampled for diagnostics) rather than failing the whole load, since a
 * handful of bad rows shouldn't take down an otherwise-usable dataset. A structurally
 * broken file (wrong header) fails the whole parse.
 */
export function parseActivitiesCsv(csvText: string): { events: ActivityEvent[]; result: LoadResult } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    throw new Error('CSV is empty');
  }

  const header = lines[0]!.split(',').map((h) => h.trim());
  const headerMatches =
    header.length === EXPECTED_CSV_HEADER.length &&
    header.every((h, i) => h === EXPECTED_CSV_HEADER[i]);
  if (!headerMatches) {
    throw new Error(
      `Unexpected CSV header. Expected [${EXPECTED_CSV_HEADER.join(',')}], got [${header.join(',')}]`,
    );
  }

  const events: ActivityEvent[] = [];
  const skippedReasons: string[] = [];
  let skipped = 0;

  const recordSkip = (reason: string) => {
    skipped++;
    if (skippedReasons.length < MAX_SAMPLE_REASONS) skippedReasons.push(reason);
  };

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1; // 1-indexed, matches file line numbers
    const line = lines[i]!;
    const parts = splitDataLine(line);
    if (!parts) {
      recordSkip(`line ${lineNumber}: fewer than 4 columns`);
      continue;
    }
    const [userIdRaw, timestampRaw, actionRaw, metadataRaw] = parts;

    const userId = Number(userIdRaw);
    if (!Number.isInteger(userId)) {
      recordSkip(`line ${lineNumber}: invalid user_id "${userIdRaw}"`);
      continue;
    }

    if (!isValidIsoTimestamp(timestampRaw)) {
      recordSkip(`line ${lineNumber}: invalid timestamp "${timestampRaw}"`);
      continue;
    }
    const timestampMs = Date.parse(timestampRaw);

    const action = actionRaw.trim();
    if (action.length === 0) {
      recordSkip(`line ${lineNumber}: empty action`);
      continue;
    }

    const metadata = parseMetadata(metadataRaw);
    if (!metadata) {
      recordSkip(`line ${lineNumber}: invalid metadata JSON "${metadataRaw}"`);
      continue;
    }

    events.push({ userId, timestamp: timestampRaw, timestampMs, action, metadata });
  }

  return {
    events,
    result: {
      totalLines: lines.length - 1,
      loaded: events.length,
      skipped,
      skippedReasons,
    },
  };
}
