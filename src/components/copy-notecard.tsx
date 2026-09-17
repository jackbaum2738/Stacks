"use client";

import { useEffect, useRef, useState } from "react";
import { useLibraryRole } from "@/components/library-role-context";

const MAX_NOTE_LENGTH = 2000;

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/** A manila-style notecard for a copy's free-text note (e.g. "recommended by the Sorensens"). */
export function CopyNotecard({ copyId, initialNote }: { copyId: string; initialNote: string | null }) {
  const { canEdit } = useLibraryRole();
  const [note, setNote] = useState(initialNote);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNote ?? "");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) autoGrow(textareaRef.current);
  }, [editing]);

  function startEdit() {
    setDraft(note ?? "");
    setEditing(true);
  }

  async function save() {
    const value = draft.trim();
    setBusy(true);
    const res = await fetch(`/api/copies/${copyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: value || null }),
    });
    setBusy(false);
    if (!res.ok) return;
    setNote(value || null);
    setEditing(false);
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/copies/${copyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: null }),
    });
    setBusy(false);
    if (!res.ok) return;
    setNote(null);
  }

  if (editing) {
    return (
      <div className="mt-[22px] max-w-[220px] rounded-[2px] border border-manila-line bg-manila p-[14px] shadow-[0_7px_0_-4px_var(--manila-shadow)]">
        <span className="mb-[7px] block font-mono text-[10px] tracking-[.14em] text-manila-ink/65 uppercase">Note</span>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            autoGrow(e.target);
          }}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Recommended by..."
          autoFocus
          className="min-h-[44px] w-full resize-y overflow-hidden rounded-[2px] border border-manila-line bg-[color-mix(in_srgb,var(--manila)_55%,var(--surface)_45%)] p-2 font-display text-[14.5px] leading-[1.45] text-manila-ink italic focus-visible:outline-2 focus-visible:outline-accent-2"
        />
        <div className="mt-[9px] flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-manila-ink/60">
            {draft.length} / {MAX_NOTE_LENGTH}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="rounded-[2px] border border-manila-line/90 px-[11px] py-1.5 font-sans text-[12.5px] font-medium text-manila-ink hover:bg-manila-ink/8"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-[2px] bg-ink px-[11px] py-1.5 font-sans text-[12.5px] font-medium text-surface hover:brightness-95"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        onClick={startEdit}
        className="mt-[22px] flex max-w-[200px] items-center gap-[7px] rounded-[2px] border border-dashed border-line-strong px-4 py-3.5 font-sans text-[12.5px] text-ink-faint hover:border-accent-2 hover:text-accent-2"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[13px] w-[13px] flex-shrink-0">
          <path d="M10 4v12M4 10h12" strokeLinecap="round" />
        </svg>
        Add a note
      </button>
    );
  }

  return (
    <div className="notecard-tape notecard-fold group relative mt-[22px] max-w-[200px] rotate-[-1.6deg] rounded-[2px] border border-manila-line bg-manila p-4 pb-3.5 text-manila-ink shadow-[0_7px_0_-4px_var(--manila-shadow)] transition-transform hover:rotate-[-0.4deg]">
      {canEdit && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={startEdit}
            title="Edit note"
            aria-label="Edit note"
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[2px] bg-manila-ink/10 hover:bg-manila-ink/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            title="Delete note"
            aria-label="Delete note"
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[2px] bg-manila-ink/10 hover:bg-manila-ink/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3 w-3">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
      <span className="mb-[7px] block font-mono text-[10px] tracking-[.14em] text-manila-ink/65 uppercase">Note</span>
      <p className="font-display text-[15px] leading-[1.45] whitespace-pre-wrap italic break-words">{note}</p>
    </div>
  );
}
