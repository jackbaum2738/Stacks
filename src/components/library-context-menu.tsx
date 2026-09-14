export interface ContextMenuTarget {
  id: string;
  title: string;
  x: number;
  y: number;
  reserved: boolean;
}

export function LibraryContextMenu({
  target,
  onOpen,
  onReserve,
  onDelete,
}: {
  target: ContextMenuTarget;
  onOpen: () => void;
  onReserve: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="paper-shadow-sm fixed z-50 w-56 overflow-hidden rounded-[2px] border border-line-strong bg-surface py-1 font-sans text-sm"
      style={{ left: Math.min(target.x, window.innerWidth - 230), top: Math.min(target.y, window.innerHeight - 160) }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="truncate border-b border-line px-3 py-2 font-display font-medium text-ink">{target.title}</p>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink hover:bg-chip-hover"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
        </svg>
        Open
      </button>
      <button
        type="button"
        onClick={onReserve}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-ink hover:bg-chip-hover"
      >
        <svg viewBox="0 0 24 24" fill={target.reserved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-4 w-4">
          <path d="M7 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16l-5-3.2L7 20V4z" />
        </svg>
        {target.reserved ? "Edit reservation" : "Reserve"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-accent hover:bg-chip-hover"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
        Remove from library
      </button>
    </div>
  );
}
