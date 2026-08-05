import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js';
import type { TrendPair } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function ActionTrendsChart({ trends }: { trends: TrendPair[] }) {
  const data = {
    labels: trends.map((t) => `user ${t.user_id} · ${t.action}`),
    datasets: [
      {
        label: 'Occurrences',
        data: trends.map((t) => t.count),
        backgroundColor: '#3b6ea5',
      },
    ],
  };

  return (
    <div className="chart-wrap">
      <Bar
        data={data}
        options={{
          responsive: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Top 3 user-action pairs' },
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } },
          },
        }}
      />
    </div>
  );
}
