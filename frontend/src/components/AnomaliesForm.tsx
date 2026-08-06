import { fetchAnomalies } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { AnomalyEvent, Page } from '../types';
import { formatDuration, formatTimestamp } from '../format';
import { ActivityFilters } from './ActivityFilters';

export function AnomaliesForm() {
  const {
    data: anomalies,
    loading,
    error,
    reset,
    initialValues,
    handleSubmit,
  } = useUrlFilters<Page<AnomalyEvent>>(true, (filters, signal) =>
    fetchAnomalies({ userId: filters.userId!, startTime: filters.startTime, endTime: filters.endTime }, signal),
  );

  return (
    <section className="card">
      <h2>Anomalies</h2>
      <ActivityFilters
        initialValues={initialValues}
        loading={loading}
        onSubmit={handleSubmit}
        onInvalid={reset}
      />

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
            {anomalies.items.map((a) => (
              <tr key={`${a.timestamp}|${a.action}`}>
                <td>{formatTimestamp(a.timestamp)}</td>
                <td>{a.action}</td>
                <td>{formatDuration(a.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
