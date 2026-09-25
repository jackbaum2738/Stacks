"use client";

import { useState } from "react";

interface ModalPerson {
  id: string;
  name: string;
  activeReservationCount: number;
}

/**
 * Unlike removing a copy, removing a person is always allowed even while they're holding
 * books -- a Person isn't a user account, so there's no account-level reason to block it.
 * The confirmation wording just changes to say what happens to those books, mirroring how
 * removing a reserved copy already warns before releasing it.
 */
export function DeletePersonModal({
  person,
  code,
  onClose,
  onDone,
}: {
  person: ModalPerson;
  code: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message =
    person.activeReservationCount === 0
      ? `Remove “${person.name}” from your People directory?`
      : person.activeReservationCount === 1
        ? `“${person.name}” is currently holding 1 book. Removing them will release it back to Available. Remove anyway?`
        : `“${person.name}” is currently holding ${person.activeReservationCount} books. Removing them will release all of them back to Available. Remove anyway?`;

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/${code}/people/${person.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't remove this person — please try again.");
      return;
    }
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[400px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
        <h2 className="mb-2 font-display text-2xl font-semibold text-ink">Remove person?</h2>
        <p className="mb-5 font-sans text-sm leading-[1.55] text-ink-soft">{message}</p>
        {error && <p className="mb-3 font-mono text-xs text-accent">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="rounded-[2px] bg-accent px-3 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
