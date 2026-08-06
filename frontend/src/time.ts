/**
 * A `datetime-local` input's value has no seconds or offset (e.g.
 * "2024-01-01T05:21"). The API and source data are UTC end-to-end
 * (CLAUDE.md §4), so the fix is to treat that literal clock value as already
 * UTC and append seconds + `Z` — never round-trip it through `new Date(...)`,
 * which reinterprets it as browser-local time and shifts the query window
 * (in UTC-3, a 05:21 filter would silently become 08:21Z).
 */
export function datetimeLocalToUtcIso(value: string): string {
  return `${value}:00Z`;
}

/**
 * Inverse of datetimeLocalToUtcIso — recovers a datetime-local input value
 * (`YYYY-MM-DDTHH:mm`) from the full UTC ISO string stored in a URL query
 * param, so a pasted/reloaded URL can pre-fill the form. Takes the first 16
 * characters regardless of what follows (seconds/fraction/Z), since the
 * input never shows more precision than minutes.
 */
export function utcIsoToDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}
