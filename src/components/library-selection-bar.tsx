export function LibrarySelectionBar({
  count,
  onClear,
  onEditReservations,
  onMoveShelf,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onEditReservations: () => void;
  onMoveShelf: () => void;
  onDelete: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 bg-accent px-[14px] py-[10px] text-on-accent">
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        title="Clear selection"
        className="rounded-[2px] p-1 hover:bg-black/10"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <span className="font-mono text-[13px] font-medium tracking-[.08em] uppercase">
        {count} selected
      </span>
      <div className="ml-auto flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEditReservations}
          className="inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 font-sans text-sm font-medium hover:bg-black/10"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M7 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16l-5-3.2L7 20V4z" />
          </svg>
          Edit reservations
        </button>
        <button
          type="button"
          onClick={onMoveShelf}
          className="inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 font-sans text-sm font-medium hover:bg-black/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <rect x="3" y="4" width="18" height="16" rx="1" />
            <path d="M3 9h18" />
            <path d="M8 14l3 3 5-6" />
          </svg>
          Move to shelf
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 font-sans text-sm font-medium text-[#F2D3CE] hover:bg-black/10"
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
