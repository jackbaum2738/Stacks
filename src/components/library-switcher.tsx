"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NEW_LIBRARY_VALUE = "__new__";

export function LibrarySwitcher({
  libraries,
  activeId,
}: {
  libraries: { id: string; name: string }[];
  activeId: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSelect(value: string) {
    if (value === NEW_LIBRARY_VALUE) {
      setCreating(true);
      return;
    }
    await fetch("/api/library/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraryId: value }),
    });
    router.push("/dashboard");
    router.refresh();
  }

  async function createLibrary(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    setCreating(false);
    setNewName("");
    setBusy(false);
    router.push("/dashboard");
    router.refresh();
  }

  if (creating) {
    return (
      <form onSubmit={createLibrary} className="flex items-center gap-2">
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New library name"
          required
          className="w-40 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-gray-900 px-2 py-1 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
        >
          Create
        </button>
        <button type="button" onClick={() => setCreating(false)} className="text-sm text-gray-500">
          Cancel
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <select
      value={activeId}
      onChange={(e) => onSelect(e.target.value)}
      className="max-w-[10rem] truncate rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm sm:max-w-none dark:border-gray-700"
    >
      {libraries.map((lib) => (
        <option key={lib.id} value={lib.id}>
          {lib.name}
        </option>
      ))}
      <option value={NEW_LIBRARY_VALUE}>+ New library…</option>
    </select>
  );
}
