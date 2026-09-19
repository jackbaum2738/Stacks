"use client";

export function MakeOwnerModal({
  memberName,
  otherChangeCount,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  memberName: string;
  /** How many other staged role changes will save alongside this transfer. */
  otherChangeCount: number;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-[400px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
        <h2 className="mb-2 font-display text-2xl font-semibold text-ink">Make owner?</h2>
        <p className="mb-5 font-sans text-sm leading-[1.55] text-ink-soft">
          <span className="font-medium text-ink">{memberName}</span> will become the owner. You will not be able to
          change this back yourself.
          {otherChangeCount > 0 && (
            <>
              {" "}
              The other {otherChangeCount === 1 ? "1 role change" : `${otherChangeCount} role changes`} you made will
              save at the same time.
            </>
          )}
        </p>
        {error && <p className="mb-3 font-mono text-xs text-accent">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-[2px] bg-accent-2 px-3 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
          >
            Make owner
          </button>
        </div>
      </div>
    </div>
  );
}
