import { useEffect, useState } from 'react';
import { fetchSessions } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { SessionsPage } from '../types';
import { formatDuration, formatTimestamp } from '../format';
import { Pagination } from './Pagination';
import { SessionTimeline, sessionKey } from './SessionTimeline';
import { Skeleton } from './Skeleton';

interface SessionsPanelProps {
  /** Reports the total once known, so UserDetail can label the tab trigger. */
  onTotalChange?: (total: number) => void;
}

/**
 * Lifted verbatim from the deleted SessionsForm — same stable row keys,
 * formatters, SessionTimeline and Pagination. Only the surrounding chrome
 * (ActivityFilters, ScreenLayout) is gone; the filter bar lives once at the
 * UsersScreen level now.
 */
export function SessionsPanel({ onTotalChange }: SessionsPanelProps) {
  const {
    data: sessions,
    loading,
    error,
    initialValues,
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
    { paginated: true, tabbed: true },
  );

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  useEffect(() => {
    if (sessions) onTotalChange?.(sessions.total);
  }, [sessions, onTotalChange]);

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {loading && !sessions && <Skeleton rows={5} />}
      {sessions && sessions.items.length === 0 && (
        <p className="empty-state">No sessions in this range. Try widening the dates or another user.</p>
      )}
      {sessions && sessions.items.length > 0 && sessions.range_start && sessions.range_end && (
        <div
          className="result-region"
          key={`${initialValues.userId}|${initialValues.startTime}|${initialValues.endTime}`}
        >
          <SessionTimeline
            sessions={sessions.items}
            rangeStart={sessions.range_start}
            rangeEnd={sessions.range_end}
            hoveredKey={hoveredKey}
            onHoverChange={setHoveredKey}
          />
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
    </>
  );
}
