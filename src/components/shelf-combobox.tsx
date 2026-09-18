"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface ShelfSummary {
  id: string;
  name: string;
  code: string | null;
}

/**
 * Search-and-select against a library's shelves, matching the interaction pattern of
 * PersonCombobox (type-ahead, click to select) but keyed for the scan station's barcode
 * workflow: matches against both shelf name and code, and resolves an exact/unique match
 * on Enter (rather than only on click) since a shelf barcode scan ends by sending Enter
 * with no further click possible.
 */
export const ShelfCombobox = forwardRef<
  HTMLInputElement,
  {
    id?: string;
    shelves: ShelfSummary[];
    selected: ShelfSummary | null;
    onChange: (shelf: ShelfSummary | null) => void;
    onEnterResolved?: (shelf: ShelfSummary) => void;
    onEnterUnresolved?: () => void;
    placeholder?: string;
  }
>(function ShelfCombobox(
  { id, shelves, selected, onChange, onEnterResolved, onEnterUnresolved, placeholder = "Type a shelf name or scan its code…" },
  forwardedRef,
) {
  const [text, setText] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    // Only sync text when a selection is made from outside typing (a click, or the parent
    // pre-selecting a default shelf on mount) -- syncing on every null transition too would
    // stomp on the user's own keystrokes, since typing itself sets selected to null via
    // onChange to clear a stale selection before a new one is resolved.
    if (selected) setText(selected.name);
  }, [selected]);

  const query = text.trim().toLowerCase();
  const matches = query
    ? shelves.filter((s) => s.name.toLowerCase().includes(query) || s.code?.toLowerCase().includes(query))
    : shelves;
  const visible = matches.slice(0, 8);

  function resolveMatch(value: string): ShelfSummary | null {
    const q = value.trim().toLowerCase();
    if (!q) return null;
    const exactCode = shelves.find((s) => s.code?.toLowerCase() === q);
    if (exactCode) return exactCode;
    const exactName = shelves.find((s) => s.name.toLowerCase() === q);
    if (exactName) return exactName;
    const filtered = shelves.filter((s) => s.name.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q));
    return filtered.length === 1 ? filtered[0] : null;
  }

  function pick(shelf: ShelfSummary) {
    onChange(shelf);
    setText(shelf.name);
    setOpen(false);
    setError(null);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        id={id}
        ref={inputRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(null);
          setOpen(true);
          setError(null);
        }}
        onFocus={(e) => {
          setOpen(true);
          // Select the current text so refocusing via the ISBN field's Enter jump (as
          // happens on every scan cycle) lets a fresh barcode scan overwrite it in place,
          // rather than appending onto whatever shelf was scanned last.
          e.target.select();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key !== "Enter") return;
          e.preventDefault();
          const resolved = selected ?? resolveMatch(text);
          if (!resolved) {
            setError(text.trim() ? `No shelf matches "${text.trim()}" — check the barcode or pick from the list.` : "Choose a shelf first.");
            onEnterUnresolved?.();
            return;
          }
          pick(resolved);
          onEnterResolved?.(resolved);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full border border-line-strong bg-surface px-3 py-2.5 font-sans text-[15px] text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
      />

      {open && (visible.length > 0 || query) && (
        <ul className="paper-shadow-sm absolute z-10 mt-1 max-h-[240px] w-full overflow-y-auto overflow-x-hidden rounded-[2px] border border-line-strong bg-surface text-sm">
          {visible.length === 0 ? (
            <li className="px-3 py-2 font-sans text-sm text-ink-faint">No shelf matches — check the name or code</li>
          ) : (
            visible.map((shelf) => (
              <li key={shelf.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(shelf)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-chip-hover"
                >
                  <span className="font-medium text-ink">{shelf.name}</span>
                  {shelf.code ? (
                    <span className="flex-shrink-0 rounded-[2px] border border-line bg-chip-hover px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-2">
                      {shelf.code}
                    </span>
                  ) : (
                    <span className="flex-shrink-0 font-mono text-[11px] text-ink-faint italic">no code</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {error && <p className="mt-1.5 font-sans text-xs text-accent">{error}</p>}
    </div>
  );
});
