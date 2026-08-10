import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Wordmark } from './Wordmark';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/users', label: 'Users' },
  { to: '/trends', label: 'Trends' },
];

export function Layout() {
  // Carrying the current query string into every nav link is what makes
  // switching screens for the same user preserve ?user_id=... — the URL
  // already holds the filters, so there's no shared state to wire up.
  const location = useLocation();

  return (
    <>
      <header className="app-header">
        <span className="brand">
          <Wordmark />
          Activity Analytics
        </span>
        <nav className="app-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={{ pathname: item.to, search: location.search }}
              end={item.end}
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
