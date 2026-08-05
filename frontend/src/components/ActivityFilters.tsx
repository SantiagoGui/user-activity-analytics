import { useState, type FormEvent } from 'react';
import { validateFilters } from '../validation';
import { datetimeLocalToUtcIso } from '../time';

export interface FilterValues {
  userId?: number;
  startTime?: string;
  endTime?: string;
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
}

export function ActivityFilters({ requireUserId = true, loading, onSubmit, onInvalid }: ActivityFiltersProps) {
  const [userId, setUserId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

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
          User ID
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
        Start time (optional)
        <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </label>
      <label>
        End time (optional)
        <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Loading…' : 'Submit'}
      </button>
      {validationError && <p className="error">{validationError}</p>}
    </form>
  );
}
