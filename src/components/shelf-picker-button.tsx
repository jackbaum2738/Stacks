"use client";

import { useEffect, useRef, useState } from "react";
import type { ShelfSummary } from "@/components/shelf-combobox";

/**
 * A copy's shelf, shown as a clickable name-plus-chevron trigger that opens a floating
 * search-and-select panel and applies the move immediately on pick -- no separate modal, no
 * Save/Cancel. Replaces the earlier underline-text-opens-a-modal treatment per the approved
 * mockup (round 9): every per-row/tile/detail shelf display is this one trigger, matching how
 * the panel behaves for the Scan station's ShelfCombobox (type or click, name or code).
 */
export function ShelfPickerButton({
  code,
  copyId,
  shelfId,
  shelfName,
  shelves,
  onMoved,
  triggerClassName = "",
  panelWidth = 230,
}: {
  code: string;
  copyId: string;
  shelfId: string | null;
  shelfName: string | null;
  shelves: ShelfSummary[];
  onMoved: (shelf: ShelfSummary) => void;
  triggerClassName?: string;
  panelWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 0);
    const close = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const closeOnScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", () => setOpen(false));
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  function openPanel() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - panelWidth - 8),
      });
    }
    setText("");
    setError(null);
    setOpen(true);
  }

  const query = text.trim().toLowerCase();
  const matches = (
    query ? shelves.filter((s) => s.name.toLowerCase().includes(query) || s.code?.toLowerCase().includes(query)) : shelves
  ).slice(0, 8);

  async function pick(shelf: ShelfSummary) {
    if (shelf.id === shelfId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/${code}/copies/${copyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shelfId: shelf.id }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't move this copy — try again.");
      return;
    }
    setOpen(false);
    onMoved(shelf);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else openPanel();
        }}
        className={`inline-flex min-w-0 items-center gap-1 rounded-[2px] px-1.5 py-0.5 hover:bg-chip-hover ${
          open ? "bg-chip-hover" : ""
        } ${triggerClassName}`}
      >
        <span className={`min-w-0 truncate ${shelfName ? "" : "italic text-ink-faint"}`}>{shelfName ?? "No shelf"}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-2.5 w-2.5 flex-shrink-0 opacity-55">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          role="listbox"
          onClick={(e) => e.stopPropagation()}
          style={{ top: pos.top, left: pos.left, width: panelWidth }}
          className="paper-shadow-sm fixed z-50 flex flex-col overflow-hidden rounded-[2px] border border-line-strong bg-surface"
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Search shelves…"
            autoComplete="off"
            disabled={busy}
            className="border-b border-line bg-surface px-3 py-2 font-mono text-[13px] text-ink placeholder:text-ink-faint focus-visible:outline-none"
          />
          <ul className="max-h-[200px] overflow-y-auto p-1">
            {matches.length === 0 ? (
              <li className="px-2.5 py-2 font-sans text-[12.5px] text-ink-faint">No shelf matches &ldquo;{text}&rdquo;</li>
            ) : (
              matches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => pick(s)}
                    className={`flex w-full items-center justify-between gap-2 rounded-[2px] px-2 py-1.5 text-left font-sans text-[13.5px] hover:bg-chip-hover ${
                      s.id === shelfId ? "bg-pill-available-bg text-pill-available-fg" : "text-ink"
                    }`}
                  >
                    <span className="min-w-0 truncate">{s.name}</span>
                    {s.code ? (
                      <span className="flex-shrink-0 rounded-[2px] border border-line bg-chip-hover px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-accent-2">
                        {s.code}
                      </span>
                    ) : (
                      <span className="flex-shrink-0 font-mono text-[10.5px] text-ink-faint italic">no code</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
          {error && <p className="border-t border-line px-2.5 py-1.5 font-mono text-[11px] text-accent">{error}</p>}
        </div>
      )}
    </>
  );
}
