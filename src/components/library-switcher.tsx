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
          className="w-40 border-b border-line-strong bg-transparent px-0.5 py-1 font-sans text-sm text-ink focus-visible:border-accent focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-[2px] bg-ink px-2 py-1 font-sans text-sm font-medium text-surface hover:brightness-95 disabled:opacity-50"
        >
          Create
        </button>
        <button type="button" onClick={() => setCreating(false)} className="font-sans text-sm text-ink-soft">
          Cancel
        </button>
        {error && <p className="font-sans text-sm text-accent">{error}</p>}
      </form>
    );
  }

  return (
    <div className="relative">
      <select
        value={activeId}
        onChange={(e) => onSelect(e.target.value)}
        className="max-w-[10rem] appearance-none truncate border border-line-strong bg-transparent py-1 pr-6 pl-[9px] font-mono text-[13px] text-ink uppercase sm:max-w-none"
      >
        {libraries.map((lib) => (
          <option key={lib.id} value={lib.id}>
            {lib.name}
          </option>
        ))}
        <option value={NEW_LIBRARY_VALUE}>+ New library…</option>
      </select>
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[9px] text-ink-faint">
        ▾
      </span>
    </div>
  );
}
