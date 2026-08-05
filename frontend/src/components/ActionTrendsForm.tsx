import { useState, type FormEvent } from 'react';
import { fetchActionTrends } from '../api';
import type { TrendPair } from '../types';
import { ActionTrendsChart } from './ActionTrendsChart';

function validate(startTime: string, endTime: string): string | null {
  if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
    return 'Start time must not be after end time.';
  }
  return null;
}

export function ActionTrendsForm() {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trends, setTrends] = useState<TrendPair[] | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTrends(null);

    const validationError = validate(startTime, endTime);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const data = await fetchActionTrends({
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
      });
      setTrends(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Action Trends</h2>
      <form onSubmit={handleSubmit}>
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
      {trends && trends.length === 0 && <p>No data for the given time range.</p>}
      {trends && trends.length > 0 && <ActionTrendsChart trends={trends} />}
    </section>
  );
}
