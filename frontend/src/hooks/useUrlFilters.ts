import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from './useQuery';
import { validateFilters } from '../validation';
import { utcIsoToDatetimeLocal } from '../time';
import type { BucketSize, Page } from '../types';

export interface FilterValues {
  userId?: number;
  startTime?: string;
  endTime?: string;
}

export interface InitialFilterValues {
  userId: string;
  startTime: string;
  endTime: string;
}

type Fetcher<T> = (
  filters: {
    userId?: number;
    startTime?: string;
    endTime?: string;
    page?: number;
    pageSize?: number;
    bucket?: BucketSize;
  },
  signal: AbortSignal,
) => Promise<T>;

export type Tab = 'sessions' | 'anomalies';

const DEFAULT_PAGE_SIZE = 20;
const BUCKET_SIZES: readonly BucketSize[] = ['day', 'week', 'month'];
const DEFAULT_BUCKET: BucketSize = 'week';
const TABS: readonly Tab[] = ['sessions', 'anomalies'];
const DEFAULT_TAB: Tab = 'sessions';

interface UseUrlFiltersOptions {
  /** Sessions/Anomalies read/write ?page=&page_size= and get the "don't
   *  collapse the table on page change" + out-of-range-page behaviors below.
   *  Summary/Trends don't paginate, so they leave this off. */
  paginated?: boolean;
  /** Overview reads/writes ?bucket= and passes it to the fetcher. Other
   *  screens leave this off, so bucket never reaches their fetcher call. */
  bucketed?: boolean;
  /** UsersScreen reads/writes ?tab= for the sessions/anomalies tabs. Not
   *  passed to the fetcher — each tab's panel owns its own useUrlFilters call
   *  against its own endpoint, so this is UI state only. */
  tabbed?: boolean;
}

/**
 * Wires a screen's filters to the URL's query string instead of local
 * component state: the URL *is* the state. Reading it is what makes a
 * pasted/reloaded URL reproduce the exact view; writing to it on submit is
 * what makes the back button and cross-screen filter persistence work for
 * free, since every screen reads the same three params.
 */
export function useUrlFilters<T>(requireUserId: boolean, fetcher: Fetcher<T>, options: UseUrlFiltersOptions = {}) {
  const { paginated = false, bucketed = false, tabbed = false } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, run, reset } = useQuery<T>();

  const userIdParam = searchParams.get('user_id');
  const startTimeParam = searchParams.get('start_time');
  const endTimeParam = searchParams.get('end_time');
  const pageParam = searchParams.get('page');
  const pageSizeParam = searchParams.get('page_size');
  const bucketParam = searchParams.get('bucket');
  const tabParam = searchParams.get('tab');

  const page = paginated && pageParam !== null && /^\d+$/.test(pageParam) ? Number(pageParam) : 1;
  const pageSize =
    paginated && pageSizeParam !== null && /^\d+$/.test(pageSizeParam) ? Number(pageSizeParam) : DEFAULT_PAGE_SIZE;
  // An unrecognised value in a pasted URL falls back to the default rather than
  // erroring — the backend would 400, and a bad bookmark shouldn't be a dead end.
  const bucket: BucketSize = BUCKET_SIZES.find((b) => b === bucketParam) ?? DEFAULT_BUCKET;
  const tab: Tab = TABS.find((t) => t === tabParam) ?? DEFAULT_TAB;

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

    run(
      (signal) =>
        fetcher(
          {
            userId: requireUserId ? Number(userIdParam) : undefined,
            startTime: startTimeParam ?? undefined,
            endTime: endTimeParam ?? undefined,
            page: paginated ? page : undefined,
            pageSize: paginated ? pageSize : undefined,
            bucket: bucketed ? bucket : undefined,
          },
          signal,
        ),
      { keepDataOnLoad: paginated },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdParam, startTimeParam, endTimeParam, requireUserId, page, pageSize, paginated, bucket, bucketed]);

  // Out-of-range page (e.g. a deep link to page 99 of a 3-page result):
  // once a response comes back with a lower total_pages than what was
  // requested, clamp the URL down to the last real page. That re-triggers
  // the effect above with a valid page instead of leaving the table stuck
  // showing an empty result for a page that doesn't exist.
  useEffect(() => {
    if (!paginated || !data) return;
    const totalPages = (data as unknown as Page<unknown>).total_pages;
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginated, data]);

  function handleSubmit(filters: FilterValues) {
    const next = new URLSearchParams();
    if (filters.userId !== undefined) next.set('user_id', String(filters.userId));
    if (filters.startTime) next.set('start_time', filters.startTime);
    if (filters.endTime) next.set('end_time', filters.endTime);
    // A filter change starts back at page 1, but keeps the chosen page size,
    // bucket and tab — none of those are part of the submitted form.
    if (paginated && pageSizeParam !== null) next.set('page_size', pageSizeParam);
    if (bucketed && bucketParam !== null) next.set('bucket', bucketParam);
    if (tabbed && tabParam !== null) next.set('tab', tabParam);
    setSearchParams(next);
  }

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  }

  function setPageSize(nextPageSize: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page_size', String(nextPageSize));
    next.set('page', '1');
    setSearchParams(next);
  }

  function setBucket(next: BucketSize) {
    const params = new URLSearchParams(searchParams);
    params.set('bucket', next);
    setSearchParams(params);
  }

  // Writes tab and resets page in the same setSearchParams call, so only one
  // navigation occurs and the fetch effect fires once — a page number from the
  // previous tab is meaningless in the new one.
  function setTab(next: Tab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    params.set('page', '1');
    setSearchParams(params);
  }

  return {
    data,
    loading,
    error,
    reset,
    initialValues,
    handleSubmit,
    page,
    pageSize,
    setPage,
    setPageSize,
    bucket,
    setBucket,
    tab,
    setTab,
  };
}
