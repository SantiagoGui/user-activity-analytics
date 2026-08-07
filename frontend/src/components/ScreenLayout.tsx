import { useState, type ReactNode } from 'react';

interface ScreenLayoutProps {
  title: string;
  filters: ReactNode;
  children: ReactNode;
  /** Whether a result already exists at mount (e.g. a pasted URL with
   *  filters). Only read once — the rail starts open with no result and
   *  collapsed with one, then the user's own toggle takes over. */
  hasResult: boolean;
}

/**
 * Shared rail/results grid for every screen (docs/design.md's layout
 * section) — avoids each screen hand-rolling the same markup. The rail is a
 * <details> so it can collapse to a disclosure on narrow viewports; on wide
 * viewports index.css forces its content visible regardless of the `open`
 * attribute, since the collapse behavior is mobile-only.
 */
export function ScreenLayout({ title, filters, children, hasResult }: ScreenLayoutProps) {
  const [open] = useState(!hasResult);

  return (
    <section className="screen">
      <h2>{title}</h2>
      <div className="screen-body">
        <details className="filter-rail" open={open}>
          <summary>Filters</summary>
          {filters}
        </details>
        <div className="results">{children}</div>
      </div>
    </section>
  );
}
