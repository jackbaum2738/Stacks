"use client";

import { useState } from "react";

export function RemoveMemberModal({
  member,
  onClose,
  onDone,
}: {
  member: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/library/members/${member.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
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
        <h2 className="mb-2 font-display text-2xl font-semibold text-ink">Remove member?</h2>
        <p className="mb-5 font-sans text-sm leading-[1.55] text-ink-soft">
          Remove <span className="font-medium text-ink">{member.name}</span> from this library?
        </p>
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
