"use client";

import { useEffect, useRef, useState } from "react";

const MAX_NOTE_LENGTH = 2000;

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/** Quick-read/edit popup for a copy's note, opened from its manila tag in grid or list view. */
export function NotePopup({
  bookTitle,
  note,
  canEdit,
  onClose,
  onSave,
}: {
  bookTitle: string;
  note: string;
  canEdit: boolean;
  onClose: () => void;
  /** Persists the edited note (empty string clears it) and reports whether it succeeded. */
  onSave: (value: string) => Promise<boolean>;
}) {
  const [displayNote, setDisplayNote] = useState(note);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) autoGrow(textareaRef.current);
  }, [editing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function startEdit() {
    setDraft(displayNote);
    setEditing(true);
  }

  async function save() {
    const value = draft.trim();
    setBusy(true);
    const ok = await onSave(value);
    setBusy(false);
    if (!ok) return;
    if (!value) {
      onClose();
      return;
    }
    setDisplayNote(value);
    setEditing(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-popup-book"
        className="notecard-tape notecard-fold relative w-full max-w-[340px] rotate-[-1deg] rounded-[2px] border border-manila-line bg-manila p-[22px] pt-[26px] text-manila-ink shadow-[0_12px_0_-6px_var(--manila-shadow)]"
      >
        <div className="absolute top-[10px] right-[10px] flex gap-1">
          {!editing && canEdit && (
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
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[2px] bg-manila-ink/10 hover:bg-manila-ink/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3 w-3">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <p id="note-popup-book" className="mb-[9px] pr-12 font-mono text-[10px] tracking-[.1em] text-manila-ink/65 uppercase">
          {bookTitle}
        </p>

        {editing ? (
          <>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                autoGrow(e.target);
              }}
              maxLength={MAX_NOTE_LENGTH}
              autoFocus
              className="min-h-[44px] w-full resize-y overflow-hidden rounded-[2px] border border-manila-line bg-[color-mix(in_srgb,var(--manila)_55%,var(--surface)_45%)] p-[9px] font-display text-[16px] leading-[1.5] text-manila-ink italic focus-visible:outline-2 focus-visible:outline-accent-2"
            />
            <div className="mt-2.5 flex items-center justify-between gap-2">
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
          </>
        ) : (
          <p className="pr-2.5 font-display text-[17px] leading-[1.55] whitespace-pre-wrap italic">{displayNote}</p>
        )}
      </div>
    </div>
  );
}
