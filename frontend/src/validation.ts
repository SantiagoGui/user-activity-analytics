export interface FiltersInput {
  userId: string;
  startTime: string;
  endTime: string;
  requireUserId: boolean;
}

/**
 * Shared by every ActivityFilters instance (extracted from the three
 * near-identical `validate()` copies this replaced). The start/end
 * comparison is a plain string comparison, not `new Date(...)` — a
 * datetime-local value's `YYYY-MM-DDTHH:mm` format sorts lexicographically
 * the same as chronologically, so this needs no Date parsing (and can't
 * reintroduce a local-timezone bug on the validation path).
 */
export function validateFilters({ userId, startTime, endTime, requireUserId }: FiltersInput): string | null {
  if (requireUserId) {
    if (userId.trim() === '') return 'User is required.';
    const parsed = Number(userId);
    if (!Number.isInteger(parsed) || parsed <= 0) return 'User must be a positive integer.';
  }
  if (startTime && endTime && startTime > endTime) {
    return 'Start time must not be after end time.';
  }
  return null;
}
