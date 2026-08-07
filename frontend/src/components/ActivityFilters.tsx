import { useEffect, useState, type FormEvent } from 'react';
import { validateFilters } from '../validation';
import { datetimeLocalToUtcIso } from '../time';

export interface FilterValues {
  userId?: number;
  startTime?: string;
  endTime?: string;
}

export interface InitialFilterValues {
  userId: string;
  startTime: string;
  endTime: string;
}

interface ActivityFiltersProps {
  /** false for Action Trends, which has no user field. */
  requireUserId?: boolean;
  loading: boolean;
  onSubmit: (filters: FilterValues) => void;
  /** Called on a failed re-validation, before the local error message is set —
   *  wired to the parent's useQuery().reset() so a stale result doesn't stay
   *  on screen looking like it answers the (invalid) new query. */
  onInvalid?: () => void;
  /** Drives the draft inputs from the URL (see useUrlFilters) — re-synced
   *  whenever it changes externally (back/forward navigation, or a nav click
   *  that carried over a different query string), without fighting the
   *  user's own typing on every render. */
  initialValues?: InitialFilterValues;
}

export function ActivityFilters({
  requireUserId = true,
  loading,
  onSubmit,
  onInvalid,
  initialValues,
}: ActivityFiltersProps) {
  const [userId, setUserId] = useState(initialValues?.userId ?? '');
  const [startTime, setStartTime] = useState(initialValues?.startTime ?? '');
  const [endTime, setEndTime] = useState(initialValues?.endTime ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialValues) return;
    setUserId(initialValues.userId);
    setStartTime(initialValues.startTime);
    setEndTime(initialValues.endTime);
  }, [initialValues?.userId, initialValues?.startTime, initialValues?.endTime]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const error = validateFilters({ userId, startTime, endTime, requireUserId });
    if (error) {
      onInvalid?.();
      setValidationError(error);
      return;
    }
    setValidationError(null);
    onSubmit({
      userId: requireUserId ? Number(userId) : undefined,
      startTime: startTime ? datetimeLocalToUtcIso(startTime) : undefined,
      endTime: endTime ? datetimeLocalToUtcIso(endTime) : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {requireUserId && (
        <label>
          User
          <input
            type="number"
            min="1"
            step="1"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
        </label>
      )}
      <label>
        From
        <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </label>
      <label>
        To
        <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Loading…' : 'Run query'}
      </button>
      {validationError && <p className="error">{validationError}</p>}
    </form>
  );
}
