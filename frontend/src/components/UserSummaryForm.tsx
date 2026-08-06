import { fetchUserSummary } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { UserSummary } from '../types';
import { formatDuration } from '../format';
import { ActivityFilters } from './ActivityFilters';

export function UserSummaryForm() {
  const { data: result, loading, error, reset, initialValues, handleSubmit } = useUrlFilters<UserSummary>(
    true,
    (filters, signal) => fetchUserSummary({ userId: filters.userId!, startTime: filters.startTime, endTime: filters.endTime }, signal),
  );

  return (
    <section className="card">
      <h2>User Summary</h2>
      <ActivityFilters
        initialValues={initialValues}
        loading={loading}
        onSubmit={handleSubmit}
        onInvalid={reset}
      />

      {error && <p className="error">{error}</p>}

      {result && (
        <dl className="result">
          <dt>Total actions</dt>
          <dd>{result.total_actions}</dd>
          <dt>Most frequent action</dt>
          <dd>{result.most_frequent_action}</dd>
          <dt>Average duration</dt>
          <dd>{formatDuration(result.avg_duration)}</dd>
          <dt>Most frequent page</dt>
          <dd>{result.most_frequent_page}</dd>
        </dl>
      )}
    </section>
  );
}
