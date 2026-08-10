import { useSearchParams } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import { useDatasetBounds } from '../hooks/useDatasetBounds';
import { utcIsoToDatetimeLocal } from '../time';
import type { TopFilterValues } from './TopFilterBar';
import { TopFilterBar } from './TopFilterBar';
import { UserList } from './UserList';
import { UserDetail } from './UserDetail';

/**
 * Master–detail: a searchable list on the left (the picker itself — no more
 * `<datalist>`), the selected user's summary and tabs on the right. The
 * shared TopFilterBar writes start_time/end_time straight into the URL;
 * UserDetail's own useUrlFilters call reads them from there, same as every
 * other screen.
 */
export function UsersScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const users = useUsers(true);
  const bounds = useDatasetBounds();

  const userIdParam = searchParams.get('user_id');
  const selectedUserId = userIdParam !== null && /^\d+$/.test(userIdParam) ? Number(userIdParam) : null;

  const filterInitialValues = {
    startTime: utcIsoToDatetimeLocal(searchParams.get('start_time')),
    endTime: utcIsoToDatetimeLocal(searchParams.get('end_time')),
  };

  function handleFilterSubmit(filters: TopFilterValues) {
    // TopFilterBar already converts to UTC ISO before calling onSubmit.
    const next = new URLSearchParams(searchParams);
    next.delete('start_time');
    next.delete('end_time');
    if (filters.startTime) next.set('start_time', filters.startTime);
    if (filters.endTime) next.set('end_time', filters.endTime);
    setSearchParams(next);
  }

  function handleSelect(userId: number) {
    const next = new URLSearchParams(searchParams);
    next.set('user_id', String(userId));
    next.delete('page');
    setSearchParams(next);
  }

  return (
    <>
      <TopFilterBar initialValues={filterInitialValues} onSubmit={handleFilterSubmit} bounds={bounds} />
      <section className="screen">
        <h2>Users</h2>
        <div className="users-body">
          <UserList users={users} selectedUserId={selectedUserId} onSelect={handleSelect} loading={users.length === 0} />
          <div className="users-detail-pane">
            {selectedUserId === null ? (
              <p className="empty-state">Select a user to see their activity.</p>
            ) : (
              <UserDetail key={selectedUserId} userId={selectedUserId} />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
