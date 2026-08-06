import { fetchSessions } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { Page, SessionSummary } from '../types';
import { formatDuration, formatTimestamp } from '../format';
import { ActivityFilters } from './ActivityFilters';

export function SessionsForm() {
  const {
    data: sessions,
    loading,
    error,
    reset,
    initialValues,
    handleSubmit,
  } = useUrlFilters<Page<SessionSummary>>(true, (filters, signal) =>
    fetchSessions({ userId: filters.userId!, startTime: filters.startTime, endTime: filters.endTime }, signal),
  );

  return (
    <section className="card">
      <h2>Sessions</h2>
      <ActivityFilters
        initialValues={initialValues}
        loading={loading}
        onSubmit={handleSubmit}
        onInvalid={reset}
      />

      {error && <p className="error">{error}</p>}
      {sessions && sessions.items.length === 0 && <p>No sessions found for this user.</p>}
      {sessions && sessions.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Actions</th>
              <th>Total duration</th>
            </tr>
          </thead>
          <tbody>
            {sessions.items.map((s) => (
              <tr key={`${s.start}|${s.end}`}>
                <td>{formatTimestamp(s.start)}</td>
                <td>{formatTimestamp(s.end)}</td>
                <td>{s.actions}</td>
                <td>{formatDuration(s.total_duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
