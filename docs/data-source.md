# Data Source: `activities.csv`

Analysis of the real file fetched from:
`https://cdn.prod.website-files.com/634d5c356b8adeff5a7c6393/6884a1f50007bdc0d663422c_activities.csv`

This is the actual data the backend will fetch on startup / via `/load`. The spec's
"Sample CSV Format" section shows a *simplified* shape — the real file has extra
metadata keys and one serious parsing trap. Numbers below are from the live file as of
2026-07-19 and will drift if the CDN file is updated, but the *shape* (columns, action
set, key set) should be treated as authoritative for implementation.

## Shape

- 3,063 data rows + 1 header row, ~228 KB.
- 4 columns: `user_id`, `timestamp`, `action`, `metadata`.
- 125 unique `user_id` values, range 1–125, contiguous, no gaps. 10–40 rows per user.
- No missing/empty fields anywhere in any column.
- No duplicate rows.
- Rows are **not sorted** — neither globally by timestamp nor within a given `user_id`.
  Backend must sort when order matters (sessions, time-range queries).

## Columns

| Column | Type | Notes |
|---|---|---|
| `user_id` | integer | 1–125 in the sample file, but treat as arbitrary positive int — don't hardcode a range. |
| `timestamp` | ISO 8601 UTC, `Z` suffix | e.g. `2024-01-04T05:20:04Z`. All 3,063 rows matched this exact pattern — no timezone offsets, no fractional seconds observed. Spans full year 2024 (`2024-01-01T00:19:29Z` → `2024-12-31T17:03:44Z`). Still parse defensively — don't assume future CDN updates keep the same format. |
| `action` | string enum | Exactly 8 distinct values in the sample: `login`, `logout`, `click`, `view`, `search`, `download`, `upload`, `filter`. Roughly evenly distributed (338–405 rows each). Treat as an open string type in code (don't hard-fail on an unrecognized 9th action), but these 8 drive which metadata keys to expect. |
| `metadata` | JSON string | See below. **This column is the critical edge case.** |

## ⚠️ Critical edge case: unquoted JSON breaks naive CSV split

The `metadata` field is a raw JSON object embedded in the CSV **without being
wrapped in quotes**, even though it contains commas:

```
72,2024-01-04T05:20:04Z,logout,{"page": "dashboard", "duration": 107}
```

A standard CSV parser (or `line.split(',')`) will shred this into 5+ fields instead of
4, because the comma inside the JSON object is indistinguishable from a real column
separator. Verified: every single one of the 3,063 rows follows this same unquoted
pattern (0 rows use CSV quoting).

**Implication for the parser:** don't use a generic CSV library in "just split on
comma" mode, and don't assume RFC 4180 quoting will save you. The safe approach is to
split each line on the first 3 commas only (`user_id`, `timestamp`, `action` are
guaranteed comma-free) and treat everything after the 3rd comma as the raw `metadata`
JSON string, e.g. `line.split(',', 3)` semantics. Confirmed this reconstructs valid,
parseable JSON for all 3,063 rows with zero `JSON.parse` failures.

## `metadata` object shape, by `action`

All 5 keys seen across the file: `page`, `duration`, `file_size`, `query`, `file_type`.
Every row has `page` and `duration`. Three actions add one extra key each:

| `action` | keys present | extra key type |
|---|---|---|
| `login` | `page`, `duration` | — |
| `logout` | `page`, `duration` | — |
| `click` | `page`, `duration` | — |
| `view` | `page`, `duration` | — |
| `filter` | `page`, `duration` | — |
| `search` | `page`, `duration`, `query` | `query`: string, e.g. `"search_term_25"` |
| `download` | `page`, `duration`, `file_type` | `file_type`: string enum: `doc`, `xlsx`, `csv`, `pdf` |
| `upload` | `page`, `duration`, `file_size` | `file_size`: integer (bytes), range 34,923–9,996,190 |

- `page`: string, one of 23 distinct values (`dashboard`, `events`, `support`,
  `reports`, `settings`, `projects`, `messages`, `analytics`, `help`, `home`, `users`,
  `tasks`, `charts`, `inbox`, `results`, `documents`, `calendar`, `preferences`,
  `notifications`, `files`, `search`, `admin`, `profile`). Treat as open string, not enum,
  for forward compatibility.
- `duration`: integer seconds, observed range 5–300, always ≥ 0 in the sample
  (no negatives, no nulls). **Do not assume non-negative or non-null in production
  code** — validate defensively since the spec explicitly calls out invalid data as
  a case to handle, and this is the field `/summary`'s `avg_duration` and the
  anomaly-detection bonus both depend on.
- The key set is fully determined by `action` in the sample data, but the backend
  should read keys defensively (e.g. `metadata.duration ?? null`) rather than assuming
  a given action always carries a given key — the spec's own sample CSV doesn't
  guarantee this invariant holds for grader-supplied variants of the file.

## Other edge cases to handle regardless of what the live file currently contains

The spec explicitly calls these out as things the grader will test, even though none
of them appear in the current live CSV:

- CSV fetch fails (network error, non-200, timeout).
- CSV has wrong/missing columns, or a header that doesn't match expectations.
- A row's `user_id` isn't a valid integer.
- A row's `timestamp` isn't valid ISO 8601.
- A row's `metadata` isn't valid JSON (malformed / truncated / not an object).
- Empty CSV body (header only, or literally empty).
- Query params: missing required `user_id` on `/summary`, invalid/malformed
  `start_time`/`end_time`, `start_time > end_time`, non-existent `user_id` (0 matching
  rows → 404 per spec, not a 200 with zeroed-out fields).
