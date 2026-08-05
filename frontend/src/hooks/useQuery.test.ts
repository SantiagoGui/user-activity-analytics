import { describe, it, expect } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useQuery } from './useQuery';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useQuery', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useQuery<number>());
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading during a run, then data on success', async () => {
    const { result } = renderHook(() => useQuery<number>());
    const d = deferred<number>();

    act(() => {
      void result.current.run(() => d.promise);
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      d.resolve(42);
      await d.promise;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when the fetcher rejects', async () => {
    const { result } = renderHook(() => useQuery<number>());

    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('boom')));
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('a fast second run supersedes a slower first one, even if the first resolves later', async () => {
    const { result } = renderHook(() => useQuery<string>());
    const first = deferred<string>();
    const second = deferred<string>();

    act(() => {
      void result.current.run(() => first.promise);
    });
    act(() => {
      void result.current.run(() => second.promise);
    });

    // Second call resolves first...
    await act(async () => {
      second.resolve('second');
      await second.promise;
    });
    expect(result.current.data).toBe('second');

    // ...then the stale first call resolves — it must be ignored.
    await act(async () => {
      first.resolve('first');
      await first.promise;
    });
    expect(result.current.data).toBe('second');
  });

  it('reset() returns to idle and ignores a still-in-flight call that resolves afterwards', async () => {
    const { result } = renderHook(() => useQuery<string>());
    const pending = deferred<string>();

    act(() => {
      void result.current.run(() => pending.promise);
    });
    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current).toMatchObject({ data: null, loading: false, error: null });

    await act(async () => {
      pending.resolve('stale');
      await pending.promise;
    });
    expect(result.current).toMatchObject({ data: null, loading: false, error: null });
  });
});
