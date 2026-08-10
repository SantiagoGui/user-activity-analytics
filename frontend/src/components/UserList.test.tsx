import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserList } from './UserList';
import type { UserListEntry } from '../types';

function user(id: number, count: number): UserListEntry {
  return { user_id: id, count, activity: [1, 0, 2] };
}

const USERS = [user(1, 10), user(22, 5), user(103, 3)];

function optionFor(id: number): HTMLElement {
  return document.getElementById(`user-option-${id}`)!;
}

describe('UserList', () => {
  it('renders every user', () => {
    render(<UserList users={USERS} selectedUserId={null} onSelect={vi.fn()} loading={false} />);
    expect(optionFor(1)).toBeInTheDocument();
    expect(optionFor(22)).toBeInTheDocument();
    expect(optionFor(103)).toBeInTheDocument();
  });

  it('filters to matching IDs as you type', () => {
    render(<UserList users={USERS} selectedUserId={null} onSelect={vi.fn()} loading={false} />);
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: '22' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(optionFor(22)).toBeInTheDocument();
  });

  it('marks the selected row aria-selected', () => {
    render(<UserList users={USERS} selectedUserId={22} onSelect={vi.fn()} loading={false} />);
    expect(optionFor(22)).toHaveAttribute('aria-selected', 'true');
    expect(optionFor(1)).toHaveAttribute('aria-selected', 'false');
  });

  it('ArrowDown then Enter selects the next row', () => {
    const onSelect = vi.fn();
    render(<UserList users={USERS} selectedUserId={null} onSelect={onSelect} loading={false} />);
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(22);
  });

  it('shows "No users match." when the filter matches nothing', () => {
    render(<UserList users={USERS} selectedUserId={null} onSelect={vi.fn()} loading={false} />);
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: '999' } });
    expect(screen.getByText('No users match.')).toBeInTheDocument();
  });
});
