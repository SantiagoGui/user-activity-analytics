import { UserSummaryForm } from './components/UserSummaryForm';
import { ActionTrendsForm } from './components/ActionTrendsForm';
import { SessionsForm } from './components/SessionsForm';
import { AnomaliesForm } from './components/AnomaliesForm';

export function App() {
  return (
    <main>
      <h1>User Activity Log Analytics</h1>
      <div className="grid">
        <UserSummaryForm />
        <ActionTrendsForm />
        <SessionsForm />
        <AnomaliesForm />
      </div>
    </main>
  );
}
