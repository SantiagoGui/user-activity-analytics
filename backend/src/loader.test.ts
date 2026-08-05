import { describe, it, expect, vi } from 'vitest';
import { ActivityStore } from './store';
import { loadActivities } from './loader';

const { fetchActivitiesCsv } = vi.hoisted(() => ({ fetchActivitiesCsv: vi.fn() }));
vi.mock('./fetchCsv', () => ({ fetchActivitiesCsv }));

const HEADER = 'user_id,timestamp,action,metadata';
const GOOD_CSV = `${HEADER}\n1,2024-01-01T00:00:00Z,login,{"page":"home","duration":10}`;

describe('loadActivities', () => {
  it('populates the store on a successful fetch+parse', async () => {
    fetchActivitiesCsv.mockResolvedValueOnce(GOOD_CSV);
    const store = new ActivityStore();

    await loadActivities(store);

    expect(store.isLoaded()).toBe(true);
    expect(store.hasUser(1)).toBe(true);
  });

  it('leaves prior good data untouched when a reload fetch fails', async () => {
    fetchActivitiesCsv.mockResolvedValueOnce(GOOD_CSV);
    const store = new ActivityStore();
    await loadActivities(store);

    fetchActivitiesCsv.mockRejectedValueOnce(new Error('network down'));
    await expect(loadActivities(store)).rejects.toThrow('network down');

    // Store still has the data from the first, successful load.
    expect(store.isLoaded()).toBe(true);
    expect(store.hasUser(1)).toBe(true);
  });
});
