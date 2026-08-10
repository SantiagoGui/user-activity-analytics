import { useState } from 'react';
import { fetchSessions } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { SessionsPage } from '../types';
import { formatDuration, formatTimestamp } from '../format';
import { ActivityFilters } from './ActivityFilters';
import { Pagination } from './Pagination';
import { ScreenLayout } from './ScreenLayout';
import { SessionTimeline, sessionKey } from './SessionTimeline';

export function SessionsForm() {
  const {
    data: sessions,
    loading,
    error,
    reset,
    initialValues,
    handleSubmit,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useUrlFilters<SessionsPage>(
    true,
    (filters, signal) =>
      fetchSessions(
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

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <ScreenLayout
      title="Sessions"
      hasResult={sessions !== null}
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
      {sessions && sessions.items.length === 0 && (
        <p className="empty-state">No sessions in this range. Try widening the dates or another user.</p>
      )}
      {sessions && sessions.items.length > 0 && sessions.range_start && sessions.range_end && (
        <SessionTimeline
          sessions={sessions.items}
          rangeStart={sessions.range_start}
          rangeEnd={sessions.range_end}
          hoveredKey={hoveredKey}
          onHoverChange={setHoveredKey}
        />
      )}
      {sessions && sessions.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Start</th>
                <th>End</th>
                <th className="numeric">Actions</th>
                <th className="numeric">Total duration</th>
              </tr>
            </thead>
            <tbody>
              {sessions.items.map((s) => {
                const key = sessionKey(s);
                return (
                  <tr
                    key={key}
                    className={hoveredKey === key ? 'hovered' : undefined}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  >
                    <td className="timestamp data">{formatTimestamp(s.start)}</td>
                    <td className="timestamp data">{formatTimestamp(s.end)}</td>
                    <td className="numeric data">{s.actions}</td>
                    <td className="numeric data">{formatDuration(s.total_duration)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {sessions && sessions.total > 0 && (
        <Pagination
          page={page}
          totalPages={sessions.total_pages}
          pageSize={pageSize}
          loading={loading}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </ScreenLayout>
  );
}
