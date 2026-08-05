import { useState, type FormEvent } from 'react';
import { fetchUserSummary } from '../api';
import type { UserSummary } from '../types';

function validate(userId: string, startTime: string, endTime: string): string | null {
  if (userId.trim() === '') return 'User ID is required.';
  const parsed = Number(userId);
  if (!Number.isInteger(parsed) || parsed <= 0) return 'User ID must be a positive integer.';
  if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
    return 'Start time must not be after end time.';
  }
  return null;
}

export function UserSummaryForm() {
  const [userId, setUserId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UserSummary | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setResult(null);

    const validationError = validate(userId, startTime, endTime);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const data = await fetchUserSummary({
        userId: Number(userId),
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>User Summary</h2>
      <form onSubmit={handleSubmit}>
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
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <dl className="result">
          <dt>Total actions</dt>
          <dd>{result.total_actions}</dd>
          <dt>Most frequent action</dt>
          <dd>{result.most_frequent_action}</dd>
          <dt>Average duration</dt>
          <dd>{result.avg_duration}s</dd>
          <dt>Most frequent page</dt>
          <dd>{result.most_frequent_page}</dd>
        </dl>
      )}
    </section>
  );
}
