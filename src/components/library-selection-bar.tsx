export function LibrarySelectionBar({
  count,
  anyReserved,
  onClear,
  onReserve,
  onEditReservations,
  onDelete,
}: {
  count: number;
  anyReserved: boolean;
  onClear: () => void;
  onReserve: () => void;
  onEditReservations: () => void;
  onDelete: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-gray-900 px-3 py-2 text-white dark:bg-white dark:text-gray-900">
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        title="Clear selection"
        className="rounded p-1 hover:bg-white/10 dark:hover:bg-black/10"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <span className="text-sm font-medium">
        {count} selected
      </span>
      <div className="ml-auto flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReserve}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/10 dark:hover:bg-black/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-4 w-4">
            <path d="M7 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16l-5-3.2L7 20V4z" />
          </svg>
          Reserve
        </button>
        {anyReserved && (
          <button
            type="button"
            onClick={onEditReservations}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/10 dark:hover:bg-black/10"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M7 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16l-5-3.2L7 20V4z" />
            </svg>
            Edit reservations
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-white/10 dark:text-red-700 dark:hover:bg-black/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}
