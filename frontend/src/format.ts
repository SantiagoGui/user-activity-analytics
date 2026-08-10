/**
 * Formats a UTC ISO timestamp for display using getUTC* accessors — never
 * toLocaleString()/toString(), which render in the browser's local timezone
 * and would reintroduce the same local-time bug this phase fixes on input
 * (CLAUDE.md §4: the UI stays UTC end to end).
 */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/** e.g. "2024-01-05T07:03:25Z" -> "2024-01-05" — axis labels on the session timeline. */
export function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** e.g. "2024-01-07T04:10:14Z" -> "7 Jan 2024" — the compact form used in the
 *  top filter bar's range chip and empty states. UTC, per CLAUDE.md #4. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * e.g. 100 -> "1m 40s", 45 -> "45s".
 *
 * `seconds % 60` reintroduces float error even when `seconds` itself is a
 * clean 2-decimal value (e.g. 155.08 -> 35.08000000000001) — round the
 * remainder back to 2 decimals, and carry into minutes if that rounds it up
 * to a full 60.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round((seconds % 60) * 100) / 100;
  if (rest >= 60) return `${minutes + 1}m`;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
