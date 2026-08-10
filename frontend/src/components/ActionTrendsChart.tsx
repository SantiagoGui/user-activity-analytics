import { Link, useSearchParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Title, Tooltip, type ChartOptions } from 'chart.js';
import type { TrendPair } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function ActionTrendsChart({ trends }: { trends: TrendPair[] }) {
  const [searchParams] = useSearchParams();
  const accent = cssVar('--accent');
  const muted = cssVar('--muted');
  const ink = cssVar('--ink');
  const inkMuted = cssVar('--ink-muted');
  const panel = cssVar('--panel');
  const fontData = cssVar('--font-data');

  function userLink(userId: number): { pathname: string; search: string } {
    const params = new URLSearchParams();
    params.set('user_id', String(userId));
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time');
    if (startTime) params.set('start_time', startTime);
    if (endTime) params.set('end_time', endTime);
    return { pathname: '/users', search: params.toString() };
  }

  const data = {
    labels: trends.map((t) => `user ${t.user_id} · ${t.action}`),
    datasets: [
      {
        data: trends.map((t) => t.count),
        backgroundColor: accent,
        borderRadius: 4,
        categoryPercentage: 0.9,
        barPercentage: 0.96,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: `Top ${trends.length} user-action pairs`, color: ink },
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
    scales: {
      x: { grid: { display: false }, ticks: { color: inkMuted } },
      y: {
        beginAtZero: true,
        grid: { color: muted },
        border: { display: false },
        ticks: { precision: 0, color: inkMuted },
      },
    },
  };

  return (
    <div>
      <div className="chart-wrap">
        <Bar data={data} options={options} />
      </div>
      <div className="card">
        <h3>User-action pairs</h3>
        <ul className="plain-list">
          {trends.map((t) => (
            <li key={`${t.user_id}|${t.action}`}>
              <Link to={userLink(t.user_id)}>
                User {t.user_id} · {t.action}
              </Link>
              <span className="data numeric">{t.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
