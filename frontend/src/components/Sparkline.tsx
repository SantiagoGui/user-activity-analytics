interface SparklineProps {
  values: number[];
}

/** Scaled to its own maximum, not a shared one: a quiet user's shape is as
 *  informative as a busy user's, and a global scale would flatten most of the
 *  list into a straight line. Decorative — the count beside it is the value. */
export function Sparkline({ values }: SparklineProps) {
  const max = Math.max(...values, 1);
  const step = 90 / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(18 - (v / max) * 16).toFixed(1)}`).join(' ');

  return (
    <svg width="90" height="18" viewBox="0 0 90 18" aria-hidden="true" focusable="false" className="sparkline">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
