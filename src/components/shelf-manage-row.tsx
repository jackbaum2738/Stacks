"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ShelfManageRow({
  shelf,
  code,
}: {
  shelf: { id: string; name: string; copyCount: number };
  code: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(shelf.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/${code}/shelves/${shelf.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/${code}/shelves/${shelf.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={rename} className="flex items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border-b border-line-strong bg-transparent px-0.5 py-1.5 font-sans text-sm text-ink focus-visible:border-accent focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-[2px] bg-ink px-3 py-1.5 font-sans text-sm font-medium text-surface hover:brightness-95"
          >
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="font-sans text-sm text-ink-soft">
            Cancel
          </button>
        </form>
        {error && <p className="mt-1 font-mono text-xs text-accent">{error}</p>}
      </li>
    );
  }

  return (
    <li className="py-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-display font-medium text-ink">{shelf.name}</span>
          <span className="ml-2 font-mono text-sm text-ink-soft">
            {shelf.copyCount} {shelf.copyCount === 1 ? "book" : "books"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            title="Delete shelf"
            aria-label={`Delete ${shelf.name}`}
            className="rounded-[2px] p-1.5 text-ink-faint hover:bg-chip-hover hover:text-accent"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
      {error && <p className="mt-1 font-mono text-xs text-accent">{error}</p>}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4"
          onClick={(e) => e.target === e.currentTarget && setConfirming(false)}
        >
          <div className="w-full max-w-[400px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
            <h2 className="mb-2 font-display text-2xl font-semibold text-ink">Delete shelf?</h2>
            <p className="mb-5 font-sans text-sm leading-[1.55] text-ink-soft">
              {shelf.copyCount > 0
                ? `"${shelf.name}" still has ${shelf.copyCount} ${shelf.copyCount === 1 ? "book" : "books"} on it. Move or remove ${shelf.copyCount === 1 ? "it" : "them"} first — a shelf can only be deleted once it's empty.`
                : `Delete the "${shelf.name}" shelf? It's empty, so no books are affected. This can't be undone.`}
            </p>
            {error && <p className="mb-3 font-mono text-xs text-accent">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
              >
                {shelf.copyCount > 0 ? "Close" : "Cancel"}
              </button>
              {shelf.copyCount === 0 && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="rounded-[2px] bg-accent px-3 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
