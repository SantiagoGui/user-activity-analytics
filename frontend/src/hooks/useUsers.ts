import { useEffect, useState } from 'react';
import { fetchUsers } from '../api';
import type { UserListEntry } from '../types';

/**
 * Fetches the known user list once, for the User field's autocomplete.
 * `enabled` lets Action Trends (no user field) skip the request entirely.
 * Fails silently: the autocomplete is a convenience on top of a plain number
 * input, not something that should raise its own error banner alongside the
 * screen's real query error.
 */
export function useUsers(enabled: boolean): UserListEntry[] {
  const [users, setUsers] = useState<UserListEntry[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetchUsers(controller.signal)
      .then(setUsers)
      .catch(() => {});
    return () => controller.abort();
  }, [enabled]);

  return users;
}
