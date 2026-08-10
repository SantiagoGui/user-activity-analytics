import type { SessionSummary } from '../types';
import { formatDateOnly, formatDuration } from '../format';

interface SessionTimelineProps {
  sessions: SessionSummary[];
  rangeStart: string;
  rangeEnd: string;
  hoveredKey: string | null;
  onHoverChange: (key: string | null) => void;
}

export function sessionKey(s: SessionSummary): string {
  return `${s.start}|${s.end}`;
}

/**
 * The signature visualization (docs/design.md): each session positioned at
 * its real start time, width proportional to its own wall-clock span
 * (end - start, not total_duration — the latter sums individual action
 * durations and isn't spatial). The axis is rangeStart/rangeEnd from the
 * full (pre-pagination) session list, so it stays fixed as you paginate —
 * only the current page's sessions get drawn, but their position on the
 * axis is still correct relative to the whole query.
 */
export function SessionTimeline({ sessions, rangeStart, rangeEnd, hoveredKey, onHoverChange }: SessionTimelineProps) {
  const rangeStartMs = new Date(rangeStart).getTime();
  const rangeEndMs = new Date(rangeEnd).getTime();
  const rangeSpan = Math.max(rangeEndMs - rangeStartMs, 1);

  return (
    <div className="timeline">
      <div className="timeline-track">
        {sessions.map((s) => {
          const key = sessionKey(s);
          const startMs = new Date(s.start).getTime();
          const endMs = new Date(s.end).getTime();
          const left = ((startMs - rangeStartMs) / rangeSpan) * 100;
          const width = ((endMs - startMs) / rangeSpan) * 100;
          return (
            <div
              key={key}
              className={`timeline-bar${hoveredKey === key ? ' hovered' : ''}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${formatDateOnly(s.start)} — ${s.actions} actions, ${formatDuration(s.total_duration)}`}
              onMouseEnter={() => onHoverChange(key)}
              onMouseLeave={() => onHoverChange(null)}
            />
          );
        })}
      </div>
      <div className="timeline-labels data">
        <span>{formatDateOnly(rangeStart)}</span>
        <span>{formatDateOnly(rangeEnd)}</span>
      </div>
    </div>
  );
}
