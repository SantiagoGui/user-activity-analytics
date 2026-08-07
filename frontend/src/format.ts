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
