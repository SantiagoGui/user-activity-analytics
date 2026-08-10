import { useMemo, useState, type KeyboardEvent } from 'react';
import type { UserListEntry } from '../types';
import { Sparkline } from './Sparkline';

interface UserListProps {
  users: UserListEntry[];
  selectedUserId: number | null;
  onSelect: (userId: number) => void;
  loading: boolean;
}

/**
 * The picker itself — always-visible, real markup, our own styling. A
 * filtered listbox rather than a combobox: the list never hides, so there is
 * no popup to trap focus in or dismiss, which is why no Radix primitive is
 * needed here (see docs/superpowers/specs, §4.7).
 */
export function UserList({ users, selectedUserId, onSelect, loading }: UserListProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (q === '') return users;
    return users.filter((u) => String(u.user_id).includes(q));
  }, [users, query]);

  function handleQueryChange(next: string) {
    setQuery(next);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (filtered.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const user = filtered[activeIndex];
      if (user) onSelect(user.user_id);
    }
  }

  const activeId = filtered[activeIndex] ? `user-option-${filtered[activeIndex]!.user_id}` : undefined;

  return (
    <div className="user-list">
      <input
        type="search"
        aria-label="Search users"
        placeholder="Search by ID…"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
      />
      {loading && users.length === 0 && <p className="empty-state">Loading users…</p>}
      {!loading && filtered.length === 0 && <p className="empty-state">No users match.</p>}
      {filtered.length > 0 && (
        <ul
          role="listbox"
          aria-label="Users"
          aria-activedescendant={activeId}
          tabIndex={0}
          className="user-list-box"
          onKeyDown={handleKeyDown}
        >
          {filtered.map((u, i) => {
            const selected = u.user_id === selectedUserId;
            return (
              <li
                key={u.user_id}
                id={`user-option-${u.user_id}`}
                role="option"
                aria-selected={selected}
                className={`user-list-row${i === activeIndex ? ' active' : ''}${selected ? ' selected' : ''}`}
                onClick={() => onSelect(u.user_id)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="data user-list-id">{u.user_id}</span>
                <Sparkline values={u.activity} />
                <span className="data numeric user-list-count">{u.count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
