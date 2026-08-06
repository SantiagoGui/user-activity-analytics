import { fetchActionTrends } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { TrendPair } from '../types';
import { ActivityFilters } from './ActivityFilters';
import { ActionTrendsChart } from './ActionTrendsChart';

export function ActionTrendsForm() {
  const { data: trends, loading, error, reset, initialValues, handleSubmit } = useUrlFilters<TrendPair[]>(
    false,
    fetchActionTrends,
  );

  return (
    <section className="card">
      <h2>Action Trends</h2>
      <ActivityFilters
        requireUserId={false}
        initialValues={initialValues}
        loading={loading}
        onSubmit={handleSubmit}
        onInvalid={reset}
      />

      {error && <p className="error">{error}</p>}
      {trends && trends.length === 0 && <p>No data for the given time range.</p>}
      {trends && trends.length > 0 && <ActionTrendsChart trends={trends} />}
    </section>
  );
}
