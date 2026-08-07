import { NavLink, Outlet, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/summary', label: 'User Summary' },
  { to: '/trends', label: 'Action Trends' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/anomalies', label: 'Anomalies' },
];

export function Layout() {
  // Carrying the current query string into every nav link is what makes
  // switching screens for the same user preserve ?user_id=... — the URL
  // already holds the filters, so there's no shared state to wire up.
  const location = useLocation();

  return (
    <>
      <header className="app-header">
        <span className="brand">Activity Analytics</span>
        <nav className="app-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={{ pathname: item.to, search: location.search }}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </>
  );
}
