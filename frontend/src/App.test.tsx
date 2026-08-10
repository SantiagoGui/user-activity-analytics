import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

function emptyBodyFor(url: string): unknown {
  if (url.includes('/sessions')) return { items: [], page: 1, page_size: 20, total: 0, total_pages: 0, range_start: null, range_end: null };
  if (url.includes('/anomalies')) return { items: [], page: 1, page_size: 20, total: 0, total_pages: 0 };
  if (url.includes('/users')) return [];
  if (url.includes('/health')) return { loaded: true, total_lines: 0, rows_loaded: 0, rows_skipped: 0, skipped_reasons: [], dataset_start: null, dataset_end: null };
  return {};
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      return Promise.resolve({
        ok: true,
        json: async () => emptyBodyFor(url),
      } as Response);
    }),
  );
});

describe('legacy route redirects', () => {
  it('redirects a legacy sessions link to the users screen with a tab param', async () => {
    render(
      <MemoryRouter initialEntries={['/sessions?user_id=22&page=2']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    });
  });

  it('redirects a legacy summary link to the users screen', async () => {
    render(
      <MemoryRouter initialEntries={['/summary?user_id=22']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    });
  });
});
