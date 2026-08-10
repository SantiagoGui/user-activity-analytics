import { Link, useSearchParams } from 'react-router-dom';
import { fetchOverview } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useDatasetBounds } from '../hooks/useDatasetBounds';
import type { Overview as OverviewData } from '../types';
import { formatShortDate } from '../format';
import { TopFilterBar } from './TopFilterBar';
import { StatTile } from './StatTile';
import { ActivityChart } from './ActivityChart';
import { Skeleton } from './Skeleton';

function spanInDays(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  return `${days}d`;
}

/**
 * The `/` screen: describes the dataset (or the current filtered slice of it)
 * rather than asking for a user first. Drill-down links into /users carry the
 * current range forward, so following one preserves what you were looking at.
 */
export function Overview() {
  const { data, loading, error, initialValues, handleSubmit, bucket, setBucket } = useUrlFilters<OverviewData>(
    false,
    fetchOverview,
    { bucketed: true },
  );
  const bounds = useDatasetBounds();
  const [searchParams] = useSearchParams();

  function userLink(userId: number): { pathname: string; search: string } {
    const params = new URLSearchParams();
    params.set('user_id', String(userId));
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time');
    if (startTime) params.set('start_time', startTime);
    if (endTime) params.set('end_time', endTime);
    return { pathname: '/users', search: params.toString() };
  }

  return (
    <>
      <TopFilterBar
        initialValues={initialValues}
        onSubmit={handleSubmit}
        bounds={bounds}
        bucket={bucket}
        onBucketChange={setBucket}
        showBucket
      />
      <section className="screen">
        <h2>Overview</h2>

        {error && <p className="error" role="alert">{error}</p>}
        {loading && !data && <Skeleton rows={5} />}

        {data && data.total_events === 0 && (
          <p className="empty-state">
            No activity in this range.{' '}
            {bounds.start && bounds.end
              ? `The dataset covers ${formatShortDate(bounds.start)} – ${formatShortDate(bounds.end)}.`
              : ''}
          </p>
        )}

        {data && data.total_events > 0 && (
          <div className="result-region overview-body">
            <div className="stats">
              <StatTile label="Events" value={String(data.total_events)} />
              <StatTile label="Users" value={String(data.total_users)} />
              <StatTile label="Action types" value={String(data.distinct_actions)} />
              <StatTile label="Span" value={spanInDays(data.range_start, data.range_end)} />
            </div>

            <ActivityChart activity={data.activity} bucket={data.bucket} />

            <div className="overview-lists">
              <div className="card">
                <h3>Top actions</h3>
                <ul className="plain-list">
                  {data.top_actions.map((a) => (
                    <li key={a.action}>
                      <span>{a.action}</span>
                      <span className="data numeric">{a.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <h3>Most active users</h3>
                <ul className="plain-list">
                  {data.top_users.map((u) => (
                    <li key={u.user_id}>
                      <Link to={userLink(u.user_id)}>User {u.user_id}</Link>
                      <span className="data numeric">{u.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
