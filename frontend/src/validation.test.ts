import { describe, it, expect } from 'vitest';
import { validateFilters } from './validation';

describe('validateFilters', () => {
  it('rejects an empty user_id when requireUserId is true', () => {
    expect(validateFilters({ userId: '', startTime: '', endTime: '', requireUserId: true })).toMatch(/required/);
  });

  it('rejects a zero or non-integer user_id when requireUserId is true', () => {
    expect(validateFilters({ userId: '0', startTime: '', endTime: '', requireUserId: true })).toMatch(
      /positive integer/,
    );
    expect(validateFilters({ userId: '1.5', startTime: '', endTime: '', requireUserId: true })).toMatch(
      /positive integer/,
    );
  });

  it('accepts a valid positive integer user_id', () => {
    expect(validateFilters({ userId: '5', startTime: '', endTime: '', requireUserId: true })).toBeNull();
  });

  it('skips the user_id check entirely when requireUserId is false', () => {
    expect(validateFilters({ userId: '', startTime: '', endTime: '', requireUserId: false })).toBeNull();
  });

  it('rejects a start time after the end time, compared as strings with no Date parsing', () => {
    expect(
      validateFilters({
        userId: '1',
        startTime: '2024-06-01T00:00',
        endTime: '2024-01-01T00:00',
        requireUserId: true,
      }),
    ).toMatch(/must not be after/);
  });

  it('accepts a start time equal to or before the end time', () => {
    expect(
      validateFilters({
        userId: '1',
        startTime: '2024-01-01T00:00',
        endTime: '2024-01-01T00:00',
        requireUserId: true,
      }),
    ).toBeNull();
    expect(
      validateFilters({
        userId: '1',
        startTime: '2024-01-01T00:00',
        endTime: '2024-06-01T00:00',
        requireUserId: true,
      }),
    ).toBeNull();
  });
});
