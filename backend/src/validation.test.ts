import { describe, it, expect } from 'vitest';
import { parseBucket } from './validation';
import { HttpError } from './errors';

describe('parseBucket', () => {
  it('defaults to week when absent', () => {
    expect(parseBucket({})).toBe('week');
  });

  it('defaults to week when empty', () => {
    expect(parseBucket({ bucket: '' })).toBe('week');
  });

  it('accepts each valid granularity', () => {
    expect(parseBucket({ bucket: 'day' })).toBe('day');
    expect(parseBucket({ bucket: 'week' })).toBe('week');
    expect(parseBucket({ bucket: 'month' })).toBe('month');
  });

  it('rejects an unrecognised value with 400', () => {
    expect(() => parseBucket({ bucket: 'fortnight' })).toThrow(HttpError);
    try {
      parseBucket({ bucket: 'fortnight' });
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).message).toContain('fortnight');
    }
  });

  it('rejects a valid value in the wrong case', () => {
    // Query params are matched exactly; loose matching here would be the only
    // case-insensitive param in the API.
    expect(() => parseBucket({ bucket: 'Week' })).toThrow(HttpError);
  });
});
