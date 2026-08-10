import { useEffect, useState, type FormEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { validateFilters } from '../validation';
import { datetimeLocalToUtcIso, utcIsoToDatetimeLocal } from '../time';
import { formatShortDate } from '../format';
import type { BucketSize } from '../types';

export interface TopFilterValues {
  startTime?: string;
  endTime?: string;
}

interface TopFilterBarProps {
  initialValues: { startTime: string; endTime: string };
  onSubmit: (filters: TopFilterValues) => void;
  bounds: { start: string | null; end: string | null };
  bucket?: BucketSize;
  onBucketChange?: (next: BucketSize) => void;
  showBucket?: boolean;
}

const BUCKET_OPTIONS: { value: BucketSize; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/**
 * Shared filter surface for every screen (docs/design.md's Phase 8 amendment):
 * a range chip stating the active window, a Custom… popover for an explicit
 * range, and — only where showBucket is set — a bucket segmented control.
 * Replaces the per-screen filter rail; filters live in the URL regardless of
 * which screen renders this.
 */
export function TopFilterBar({ initialValues, onSubmit, bounds, bucket, onBucketChange, showBucket }: TopFilterBarProps) {
  const [startTime, setStartTime] = useState(initialValues.startTime);
  const [endTime, setEndTime] = useState(initialValues.endTime);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setStartTime(initialValues.startTime);
    setEndTime(initialValues.endTime);
  }, [initialValues.startTime, initialValues.endTime]);

  const isCustom = initialValues.startTime !== '' || initialValues.endTime !== '';
  const rangeLabel = isCustom
    ? `${initialValues.startTime || '…'} – ${initialValues.endTime || '…'}`
    : bounds.start && bounds.end
      ? `All data · ${formatShortDate(bounds.start)} – ${formatShortDate(bounds.end)}`
      : 'All data';

  function handleApply(event: FormEvent) {
    event.preventDefault();
    const error = validateFilters({ userId: '', startTime, endTime, requireUserId: false });
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setOpen(false);
    onSubmit({
      startTime: startTime ? datetimeLocalToUtcIso(startTime) : undefined,
      endTime: endTime ? datetimeLocalToUtcIso(endTime) : undefined,
    });
  }

  function handleClear() {
    setStartTime('');
    setEndTime('');
    setValidationError(null);
    setOpen(false);
    onSubmit({ startTime: undefined, endTime: undefined });
  }

  return (
    <div className="top-filter-bar">
      <span className="filter-chip filter-chip-range data">{rangeLabel}</span>

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" className="filter-chip filter-chip-custom">
            Custom…
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="filter-popover" sideOffset={8} align="start">
            <form onSubmit={handleApply}>
              <label htmlFor="top-filter-start">
                From
                <input
                  id="top-filter-start"
                  type="datetime-local"
                  value={startTime}
                  min={bounds.start ? utcIsoToDatetimeLocal(bounds.start) : undefined}
                  max={bounds.end ? utcIsoToDatetimeLocal(bounds.end) : undefined}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label htmlFor="top-filter-end">
                To
                <input
                  id="top-filter-end"
                  type="datetime-local"
                  value={endTime}
                  min={bounds.start ? utcIsoToDatetimeLocal(bounds.start) : undefined}
                  max={bounds.end ? utcIsoToDatetimeLocal(bounds.end) : undefined}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>
              {validationError && (
                <p className="error" role="alert">
                  {validationError}
                </p>
              )}
              <div className="filter-popover-actions">
                <button type="button" onClick={handleClear}>
                  Clear
                </button>
                <button type="submit">Apply</button>
              </div>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {showBucket && bucket && onBucketChange && (
        <fieldset className="bucket-control">
          <legend className="sr-only">Bucket size</legend>
          {BUCKET_OPTIONS.map((option) => (
            <label key={option.value} className={bucket === option.value ? 'active' : undefined}>
              <input
                type="radio"
                name="bucket"
                value={option.value}
                checked={bucket === option.value}
                onChange={() => onBucketChange(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
