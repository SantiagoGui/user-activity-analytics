interface StatTileProps {
  label: string;
  value: string;
}

/** A headline figure. Per the visualization method these are stat tiles, not a
 *  one-bar chart — four unrelated magnitudes have no shared scale to plot on. */
export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value data">{value}</div>
    </div>
  );
}
