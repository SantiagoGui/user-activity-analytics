import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from './useQuery';
import { validateFilters } from '../validation';
import { utcIsoToDatetimeLocal } from '../time';
import type { FilterValues, InitialFilterValues } from '../components/ActivityFilters';

type Fetcher<T> = (
  filters: { userId?: number; startTime?: string; endTime?: string },
  signal: AbortSignal,
) => Promise<T>;

/**
 * Wires a screen's filters to the URL's query string instead of local
 * component state: the URL *is* the state. Reading it is what makes a
 * pasted/reloaded URL reproduce the exact view; writing to it on submit is
 * what makes the back button and cross-screen filter persistence work for
 * free, since every screen reads the same three params.
 */
export function useUrlFilters<T>(requireUserId: boolean, fetcher: Fetcher<T>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, run, reset } = useQuery<T>();

  const userIdParam = searchParams.get('user_id');
  const startTimeParam = searchParams.get('start_time');
  const endTimeParam = searchParams.get('end_time');

  const initialValues: InitialFilterValues = {
    userId: userIdParam ?? '',
    startTime: utcIsoToDatetimeLocal(startTimeParam),
    endTime: utcIsoToDatetimeLocal(endTimeParam),
  };

  // The one effect that makes a pasted URL, a reload, and browser
  // back/forward all reproduce the exact view: whenever the URL's own
  // filter params change to something valid, fetch — no manual submit
  // required. A submit itself only ever changes these same params (see
  // handleSubmit below), so it goes through this identical path too.
  useEffect(() => {
    if (requireUserId && (userIdParam === null || userIdParam === '')) return;
    const error = validateFilters({
      userId: userIdParam ?? '',
      startTime: initialValues.startTime,
      endTime: initialValues.endTime,
      requireUserId,
    });
    if (error) return;

    run((signal) =>
      fetcher(
        {
          userId: requireUserId ? Number(userIdParam) : undefined,
          startTime: startTimeParam ?? undefined,
          endTime: endTimeParam ?? undefined,
        },
        signal,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdParam, startTimeParam, endTimeParam, requireUserId]);

  function handleSubmit(filters: FilterValues) {
    const next = new URLSearchParams();
    if (filters.userId !== undefined) next.set('user_id', String(filters.userId));
    if (filters.startTime) next.set('start_time', filters.startTime);
    if (filters.endTime) next.set('end_time', filters.endTime);
    setSearchParams(next);
  }

  return { data, loading, error, reset, initialValues, handleSubmit };
}
