import { fetchUserSummary } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { UserSummary } from '../types';
import { formatDuration } from '../format';
import { ActivityFilters } from './ActivityFilters';
import { ScreenLayout } from './ScreenLayout';

export function UserSummaryForm() {
  const { data: result, loading, error, reset, initialValues, handleSubmit } = useUrlFilters<UserSummary>(
    true,
    (filters, signal) => fetchUserSummary({ userId: filters.userId!, startTime: filters.startTime, endTime: filters.endTime }, signal),
  );

  return (
    <ScreenLayout
      title="User summary"
      hasResult={result !== null}
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

      {result && (
        <dl className="stats">
          <div className="stat">
            <dt>Total actions</dt>
            <dd>{result.total_actions}</dd>
          </div>
          <div className="stat">
            <dt>Most frequent action</dt>
            <dd>{result.most_frequent_action}</dd>
          </div>
          <div className="stat">
            <dt>Average duration</dt>
            <dd>{formatDuration(result.avg_duration)}</dd>
          </div>
          <div className="stat">
            <dt>Most frequent page</dt>
            <dd>{result.most_frequent_page}</dd>
          </div>
        </dl>
      )}
    </ScreenLayout>
  );
}
