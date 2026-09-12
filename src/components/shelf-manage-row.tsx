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
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
          >
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500">
            Cancel
          </button>
        </form>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </li>
    );
  }

  return (
    <li className="py-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{shelf.name}</span>
          <span className="ml-2 text-sm text-gray-500">
            {shelf.copyCount} {shelf.copyCount === 1 ? "book" : "books"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium dark:border-gray-700"
          >
            Rename
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-red-700 dark:border-gray-700 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </li>
  );
}
