"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ShelfManageRow({ shelf }: { shelf: { id: string; name: string; copyCount: number } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(shelf.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/shelves/${shelf.id}`, {
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
    if (!window.confirm(`Delete the "${shelf.name}" shelf?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/shelves/${shelf.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
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
            onClick={remove}
            disabled={busy}
            className="rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-accent hover:bg-chip-hover"
          >
            Delete
          </button>
        </div>
      </div>
      {error && <p className="mt-1 font-mono text-xs text-accent">{error}</p>}
    </li>
  );
}
