import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import type { ActivityBucket, BucketSize } from '../types';
import { formatBucketLabel } from '../format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface ActivityChartProps {
  activity: ActivityBucket[];
  bucket: BucketSize;
}

/**
 * Change-over-time for a single series: a line, one hue. Per the
 * visualization method there is no categorical palette here and none should
 * be introduced — --accent read from the token, not hardcoded.
 */
export function ActivityChart({ activity, bucket }: ActivityChartProps) {
  const accent = cssVar('--accent');
  const muted = cssVar('--muted');
  const ink = cssVar('--ink');
  const inkMuted = cssVar('--ink-muted');
  const panel = cssVar('--panel');
  const fontData = cssVar('--font-data');

  const peakIndex = useMemo(() => {
    if (activity.length === 0) return -1;
    let maxIndex = 0;
    for (let i = 1; i < activity.length; i++) {
      if (activity[i]!.count > activity[maxIndex]!.count) maxIndex = i;
    }
    return activity[maxIndex]!.count > 0 ? maxIndex : -1;
  }, [activity]);

  const data = {
    labels: activity.map((b) => formatBucketLabel(b.bucket_start, bucket)),
    datasets: [
      {
        data: activity.map((b) => b.count),
        borderColor: accent,
        backgroundColor: accent,
        pointBackgroundColor: accent,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 8, color: inkMuted } },
      y: {
        beginAtZero: true,
        grid: { color: muted },
        border: { display: false },
        ticks: { color: inkMuted, precision: 0 },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        backgroundColor: panel,
        titleColor: ink,
        bodyColor: ink,
        borderColor: muted,
        borderWidth: 1,
        padding: 10,
        bodyFont: { family: fontData },
      },
    },
    elements: {
      line: { borderWidth: 2, tension: 0 },
      point: { radius: 0, hoverRadius: 4, hitRadius: 12 },
    },
  };

  return (
    <div className="activity-chart">
      {peakIndex >= 0 && (
        <div className="activity-chart-peak data">
          Peak: {activity[peakIndex]!.count} on {formatBucketLabel(activity[peakIndex]!.bucket_start, bucket)}
        </div>
      )}
      <div className="activity-chart-canvas">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
