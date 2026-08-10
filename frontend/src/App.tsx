import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './components/Overview';
import { UsersScreen } from './components/UsersScreen';
import { ActionTrendsForm } from './components/ActionTrendsForm';

/** Preserves the query string (and adds `tab` when given) so previously
 *  shared links to the deleted per-facet screens still resolve. */
function RedirectToUsers({ tab }: { tab?: 'sessions' | 'anomalies' }) {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  if (tab) next.set('tab', tab);
  return <Navigate to={{ pathname: '/users', search: next.toString() }} replace />;
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="/users" element={<UsersScreen />} />
        <Route path="/trends" element={<ActionTrendsForm />} />
        <Route path="/summary" element={<RedirectToUsers />} />
        <Route path="/sessions" element={<RedirectToUsers tab="sessions" />} />
        <Route path="/anomalies" element={<RedirectToUsers tab="anomalies" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
