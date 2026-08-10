import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './components/Overview';
import { UserSummaryForm } from './components/UserSummaryForm';
import { ActionTrendsForm } from './components/ActionTrendsForm';
import { SessionsForm } from './components/SessionsForm';
import { AnomaliesForm } from './components/AnomaliesForm';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="/summary" element={<UserSummaryForm />} />
        <Route path="/trends" element={<ActionTrendsForm />} />
        <Route path="/sessions" element={<SessionsForm />} />
        <Route path="/anomalies" element={<AnomaliesForm />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
