import { useEffect, useState } from 'react';
import { fetchHealth } from '../api';

/**
 * The dataset's own time span, used to clamp the date inputs so a window the
 * data cannot contain becomes untypeable. Read from /health rather than
 * /overview because it must not move when the user changes the filter.
 *
 * Fails silently: without bounds the inputs are simply unclamped, which is the
 * behaviour we have today. A failed clamp must not block the screen.
 */
export function useDatasetBounds(): { start: string | null; end: string | null } {
  const [bounds, setBounds] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((health) => setBounds({ start: health.dataset_start, end: health.dataset_end }))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return bounds;
}
