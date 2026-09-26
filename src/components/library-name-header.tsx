"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formLabelClass, formInputClass } from "@/lib/form-styles";

/**
 * The "Settings" heading and the library's own name, side by side -- the name itself is the
 * rename target (Owner only), rather than a separate "Library" section. See CLAUDE.md's
 * "Rename a library" note if this needs touching again.
 */
export function LibraryNameHeader({ code, initialName, isOwner }: { code: string; initialName: string; isOwner: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    setInput(name);
    setError(null);
    setEditing(true);
  }

  async function save() {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Library name can't be empty.");
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    setName(trimmed);
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
        <h1 className="flex-shrink-0 font-display text-[32px] font-semibold text-ink">Settings</h1>
        <div className="ml-auto flex min-w-0 items-baseline gap-2.5">
          <span className="truncate font-display text-[22px] font-medium text-ink-muted">{name}</span>
          {isOwner && (
            <button
              type="button"
              onClick={openEdit}
              className="flex-shrink-0 font-sans text-[13px] font-semibold text-accent-2 hover:underline"
            >
              Change
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-[18px] flex flex-col gap-3 rounded-r-[2px] border-l-[3px] border-accent-2 bg-[color-mix(in_srgb,var(--accent-2)_10%,var(--surface))] p-4">
          <div>
            <label htmlFor="library-name-input" className={formLabelClass}>
              Library name
            </label>
            <input
              id="library-name-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              maxLength={100}
              className={formInputClass}
              autoFocus
            />
            {error && <p className="mt-1 font-mono text-xs text-accent">{error}</p>}
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-[2px] border border-line-strong px-4 py-[9px] font-sans text-[13px] font-semibold text-ink-soft hover:bg-line hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || !input.trim() || input.trim() === name}
              className="rounded-[2px] bg-accent px-4 py-[9px] font-sans text-[13px] font-semibold text-on-accent hover:brightness-95 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
