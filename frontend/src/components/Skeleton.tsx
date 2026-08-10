interface SkeletonProps {
  rows: number;
}

/** Placeholder rows at the table's own height, so a first load doesn't collapse
 *  the layout and reflow it when data arrives. Paginated tables don't use this —
 *  they keep the previous page's rows (useQuery's keepDataOnLoad). */
export function Skeleton({ rows }: SkeletonProps) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
