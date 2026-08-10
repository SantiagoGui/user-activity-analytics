import { fetchAnomalies } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { AnomalyEvent, Page } from '../types';
import { formatDuration, formatTimestamp } from '../format';
import { ActivityFilters } from './ActivityFilters';
import { Pagination } from './Pagination';
import { ScreenLayout } from './ScreenLayout';

export function AnomaliesForm() {
  const {
    data: anomalies,
    loading,
    error,
    reset,
    initialValues,
    handleSubmit,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useUrlFilters<Page<AnomalyEvent>>(
    true,
    (filters, signal) =>
      fetchAnomalies(
        {
          userId: filters.userId!,
          startTime: filters.startTime,
          endTime: filters.endTime,
          page: filters.page,
          pageSize: filters.pageSize,
        },
        signal,
      ),
    { paginated: true },
  );

  return (
    <ScreenLayout
      title="Anomalies"
      hasResult={anomalies !== null}
      filters={
        <ActivityFilters
          initialValues={initialValues}
          loading={loading}
          onSubmit={handleSubmit}
          onInvalid={reset}
        />
      }
    >
      {error && <p className="error" role="alert">{error}</p>}
      {anomalies && anomalies.items.length === 0 && (
        <p className="empty-state">No anomalies in this range. Try widening the dates or another user.</p>
      )}
      {anomalies && anomalies.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th className="numeric">Duration</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.items.map((a) => (
                <tr key={`${a.timestamp}|${a.action}`}>
                  <td className="timestamp data">{formatTimestamp(a.timestamp)}</td>
                  <td>{a.action}</td>
                  <td className="numeric data">{formatDuration(a.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {anomalies && anomalies.total > 0 && (
        <Pagination
          page={page}
          totalPages={anomalies.total_pages}
          pageSize={pageSize}
          loading={loading}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </ScreenLayout>
  );
}
