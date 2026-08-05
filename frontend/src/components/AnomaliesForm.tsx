import { useState, type FormEvent } from 'react';
import { fetchAnomalies } from '../api';
import type { AnomalyEvent, Page } from '../types';

function validate(userId: string, startTime: string, endTime: string): string | null {
  if (userId.trim() === '') return 'User ID is required.';
  const parsed = Number(userId);
  if (!Number.isInteger(parsed) || parsed <= 0) return 'User ID must be a positive integer.';
  if (startTime && endTime && new Date(startTime) > new Date(endTime)) {
    return 'Start time must not be after end time.';
  }
  return null;
}

export function AnomaliesForm() {
  const [userId, setUserId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<Page<AnomalyEvent> | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAnomalies(null);

    const validationError = validate(userId, startTime, endTime);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const data = await fetchAnomalies({
        userId: Number(userId),
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
      });
      setAnomalies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Anomalies</h2>
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
      {anomalies && anomalies.items.length === 0 && <p>No anomalies found for this user.</p>}
      {anomalies && anomalies.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.items.map((a, i) => (
              <tr key={i}>
                <td>{a.timestamp}</td>
                <td>{a.action}</td>
                <td>{a.duration}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
