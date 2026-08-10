import { useState, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { fetchUserSummary } from '../api';
import { useUrlFilters } from '../hooks/useUrlFilters';
import type { UserSummary } from '../types';
import { formatDuration } from '../format';
import { StatTile } from './StatTile';
import { SessionsPanel } from './SessionsPanel';
import { AnomaliesPanel } from './AnomaliesPanel';
import { Skeleton } from './Skeleton';

interface UserDetailProps {
  userId: number;
}

/**
 * The right-hand pane of the Users master–detail screen: a summary tile row
 * from /summary, then Sessions and Anomalies as tabs. Each tab owns its own
 * fetch against its own endpoint — this component only tracks the totals it
 * needs to label the tab triggers.
 */
export function UserDetail({ userId }: UserDetailProps) {
  const { data: summary, loading, error, tab, setTab } = useUrlFilters<UserSummary>(
    true,
    (filters, signal) => fetchUserSummary({ userId: filters.userId!, startTime: filters.startTime, endTime: filters.endTime }, signal),
    { tabbed: true },
  );

  const [sessionsTotal, setSessionsTotal] = useState<number | null>(null);
  const [anomaliesTotal, setAnomaliesTotal] = useState<number | null>(null);

  useEffect(() => {
    setSessionsTotal(null);
    setAnomaliesTotal(null);
  }, [userId]);

  return (
    <div className="user-detail">
      <h3 className="user-detail-heading">
        User <span className="data">{userId}</span>
        {summary && <span className="data user-detail-count"> · {summary.total_actions} events</span>}
      </h3>

      {error && <p className="error" role="alert">{error}</p>}
      {loading && !summary && <Skeleton rows={1} />}

      {summary && (
        <div className="stats result-region" key={userId}>
          <StatTile label="Total actions" value={String(summary.total_actions)} />
          <StatTile label="Average duration" value={formatDuration(summary.avg_duration)} />
          <StatTile label="Most frequent action" value={summary.most_frequent_action} />
          <StatTile label="Most frequent page" value={summary.most_frequent_page} />
        </div>
      )}

      <Tabs.Root value={tab} onValueChange={(next) => setTab(next as 'sessions' | 'anomalies')} className="user-tabs">
        <Tabs.List className="user-tabs-list" aria-label="User activity views">
          <Tabs.Trigger value="sessions" className="user-tabs-trigger">
            Sessions{sessionsTotal !== null && <span className="data user-tabs-count"> {sessionsTotal}</span>}
          </Tabs.Trigger>
          <Tabs.Trigger value="anomalies" className="user-tabs-trigger">
            Anomalies{anomaliesTotal !== null && <span className="data user-tabs-count"> {anomaliesTotal}</span>}
          </Tabs.Trigger>
        </Tabs.List>
        {/* forceMount + hidden (rather than conditional unmount) keeps both
            panels' useUrlFilters calls alive, so both tab triggers can show a
            count before the user has ever switched tabs. */}
        <Tabs.Content value="sessions" forceMount hidden={tab !== 'sessions'}>
          <SessionsPanel onTotalChange={setSessionsTotal} />
        </Tabs.Content>
        <Tabs.Content value="anomalies" forceMount hidden={tab !== 'anomalies'}>
          <AnomaliesPanel onTotalChange={setAnomaliesTotal} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
