import { fetchActionTrends } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { TrendPair } from '../types';
import { ActivityFilters } from './ActivityFilters';
import { ActionTrendsChart } from './ActionTrendsChart';
import { ScreenLayout } from './ScreenLayout';

export function ActionTrendsForm() {
  const { data: trends, loading, error, reset, initialValues, handleSubmit } = useUrlFilters<TrendPair[]>(
    false,
    fetchActionTrends,
  );

  return (
    <ScreenLayout
      title="Action trends"
      hasResult={trends !== null}
      filters={
        <ActivityFilters
          requireUserId={false}
          initialValues={initialValues}
          loading={loading}
          onSubmit={handleSubmit}
          onInvalid={reset}
        />
      }
    >
      {error && <p className="error" role="alert">{error}</p>}
      {trends && trends.length === 0 && (
        <p className="empty-state">No data in this range. Try widening the dates.</p>
      )}
      {trends && trends.length > 0 && <ActionTrendsChart trends={trends} />}
    </ScreenLayout>
  );
}
