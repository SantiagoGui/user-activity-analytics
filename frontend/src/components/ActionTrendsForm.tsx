import { fetchActionTrends } from '../api';
import { useQuery } from '../hooks/useQuery';
import type { TrendPair } from '../types';
import { ActivityFilters, type FilterValues } from './ActivityFilters';
import { ActionTrendsChart } from './ActionTrendsChart';

export function ActionTrendsForm() {
  const { data: trends, loading, error, run, reset } = useQuery<TrendPair[]>();

  function handleSubmit(filters: FilterValues) {
    run((signal) => fetchActionTrends({ startTime: filters.startTime, endTime: filters.endTime }, signal));
  }

  return (
    <section className="card">
      <h2>Action Trends</h2>
      <ActivityFilters requireUserId={false} loading={loading} onSubmit={handleSubmit} onInvalid={reset} />

      {error && <p className="error">{error}</p>}
      {trends && trends.length === 0 && <p>No data for the given time range.</p>}
      {trends && trends.length > 0 && <ActionTrendsChart trends={trends} />}
    </section>
  );
}
