import { useCallback, useRef, useState } from 'react';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const IDLE_STATE = { data: null, loading: false, error: null };

/**
 * Owns a fetch lifecycle (data/loading/error) so every form doesn't hand-roll
 * its own try/catch/finally. `run` both aborts the previous in-flight call's
 * AbortController (real network cancellation) and tags each call with an
 * incrementing request id checked before applying its result — belt and
 * suspenders, since not every fetcher/mock actually rejects promptly on
 * abort. Either guard alone would stop a slower, superseded call from
 * overwriting a faster, newer one's result; together they make that
 * impossible regardless of how the underlying fetcher behaves.
 */
export function useQuery<T>() {
  const [state, setState] = useState<QueryState<T>>(IDLE_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const run = useCallback(async (fetcher: (signal: AbortSignal) => Promise<T>) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    setState({ data: null, loading: true, error: null });
    try {
      const data = await fetcher(controller.signal);
      if (requestIdRef.current !== requestId) return; // superseded
      setState({ data, loading: false, error: null });
    } catch (err) {
      if (requestIdRef.current !== requestId) return; // superseded
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'Something went wrong.' });
    }
  }, []);

  // Manually returns to idle — e.g. a failed re-validation should clear a
  // stale result the same way a valid re-submit would, without letting a
  // still-in-flight older request repopulate it once it resolves.
  const reset = useCallback(() => {
    controllerRef.current?.abort();
    requestIdRef.current++;
    setState(IDLE_STATE);
  }, []);

  return { ...state, run, reset };
}
