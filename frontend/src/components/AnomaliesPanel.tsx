import { useEffect } from 'react';
import { fetchAnomalies } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { AnomalyEvent, Page } from '../types';
import { formatDuration, formatTimestamp } from '../format';
import { Pagination } from './Pagination';
import { Skeleton } from './Skeleton';

interface AnomaliesPanelProps {
  /** Reports the total once known, so UserDetail can label the tab trigger. */
  onTotalChange?: (total: number) => void;
}

/**
 * Lifted verbatim from the deleted AnomaliesForm. With population stddev at a
 * strict 2σ (CLAUDE.md #4), most users genuinely have none — the empty state
 * here and the `0` on the tab trigger are both correct answers, not failures.
 */
export function AnomaliesPanel({ onTotalChange }: AnomaliesPanelProps) {
  const {
    data: anomalies,
    loading,
    error,
    initialValues,
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
    { paginated: true, tabbed: true },
  );

  useEffect(() => {
    if (anomalies) onTotalChange?.(anomalies.total);
  }, [anomalies, onTotalChange]);

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {loading && !anomalies && <Skeleton rows={5} />}
      {anomalies && anomalies.items.length === 0 && (
        <p className="empty-state">No anomalies in this range.</p>
      )}
      {anomalies && anomalies.items.length > 0 && (
        <div
          className="table-wrap result-region"
          key={`${initialValues.userId}|${initialValues.startTime}|${initialValues.endTime}`}
        >
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
    </>
  );
}
