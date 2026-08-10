import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useUrlFilters } from './useUrlFilters';

function wrapperFor(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useUrlFilters', () => {
  it('fetches automatically when the URL already has a valid user_id — a pasted URL needs no manual submit', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useUrlFilters<string>(true, fetcher), {
      wrapper: wrapperFor('/summary?user_id=1'),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      { userId: 1, startTime: undefined, endTime: undefined },
      expect.any(AbortSignal),
    );
    expect(result.current.initialValues.userId).toBe('1');
  });

  it('does not fetch when the URL has no user_id and one is required', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok');
    renderHook(() => useUrlFilters<string>(true, fetcher), {
      wrapper: wrapperFor('/summary'),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('handleSubmit writes filters into the URL, which triggers the same fetch path', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useUrlFilters<string>(true, fetcher), {
      wrapper: wrapperFor('/summary'),
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetcher).not.toHaveBeenCalled();

    await act(async () => {
      result.current.handleSubmit({ userId: 2 });
      await Promise.resolve();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      { userId: 2, startTime: undefined, endTime: undefined },
      expect.any(AbortSignal),
    );
  });

  it('reads bucket from the URL when bucketed', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok');
    renderHook(() => useUrlFilters<string>(false, fetcher, { bucketed: true }), {
      wrapper: wrapperFor('/?bucket=month'),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher.mock.calls[0]![0].bucket).toBe('month');
  });

  it('defaults bucket to week and ignores an unrecognised value', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok');
    renderHook(() => useUrlFilters<string>(false, fetcher, { bucketed: true }), {
      wrapper: wrapperFor('/?bucket=fortnight'),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher.mock.calls[0]![0].bucket).toBe('week');
  });

  it('does not send bucket when not bucketed', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok');
    renderHook(() => useUrlFilters<string>(false, fetcher), {
      wrapper: wrapperFor('/?bucket=month'),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetcher.mock.calls[0]![0].bucket).toBeUndefined();
  });
});
