import { fetchActionTrends } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useDatasetBounds } from '../hooks/useDatasetBounds';
import type { TrendPair } from '../types';
import { ActionTrendsChart } from './ActionTrendsChart';
import { TopFilterBar } from './TopFilterBar';
import { Skeleton } from './Skeleton';

export function ActionTrendsForm() {
  const { data: trends, loading, error, initialValues, handleSubmit } = useUrlFilters<TrendPair[]>(
    false,
    fetchActionTrends,
  );
  const bounds = useDatasetBounds();

  return (
    <>
      <TopFilterBar initialValues={initialValues} onSubmit={handleSubmit} bounds={bounds} />
      <section className="screen">
        <h2>Action trends</h2>
        {error && <p className="error" role="alert">{error}</p>}
        {loading && !trends && <Skeleton rows={5} />}
        {trends && (
          <div
            className="result-region"
            key={`${initialValues.startTime}|${initialValues.endTime}`}
          >
            {trends.length === 0 && (
              <p className="empty-state">No data in this range. Try widening the dates.</p>
            )}
            {trends.length > 0 && <ActionTrendsChart trends={trends} />}
          </div>
        )}
      </section>
    </>
  );
}
