const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/** Shared by Sessions and Anomalies — both page the same `Page<T>` envelope. */
export function Pagination({ page, totalPages, pageSize, loading, onPageChange, onPageSizeChange }: PaginationProps) {
  return (
    <div className="pagination">
      <button type="button" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button type="button" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
      <label>
        Per page
        <select
          value={pageSize}
          disabled={loading}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
