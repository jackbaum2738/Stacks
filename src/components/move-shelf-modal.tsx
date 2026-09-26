"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShelfSummary } from "@/components/shelf-combobox";
import { formLabelClass } from "@/lib/form-styles";

interface ModalCopy {
  id: string;
  book: { title: string };
}

/** Moves one or more copies to a different shelf — used only for the bulk selection-bar
 * action (a single copy's shelf is changed via ShelfPickerButton instead, with no modal).
 * The shelf list is embedded and always visible rather than a floating dropdown, so the
 * whole "search and pick" interaction reads as one merged control, matching the approved
 * mockup (round 9) rather than ShelfCombobox's focus-triggered popup. */
export function MoveShelfModal({
  copies,
  code,
  onClose,
  onDone,
}: {
  copies: ModalCopy[];
  code: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const bulk = copies.length > 1;
  const [shelves, setShelves] = useState<ShelfSummary[]>([]);
  const [text, setText] = useState("");
  const [shelf, setShelf] = useState<ShelfSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/${code}/shelves`)
      .then((res) => res.json())
      .then((data) => setShelves((data.shelves ?? []).map((s: ShelfSummary) => ({ id: s.id, name: s.name, code: s.code }))))
      .catch(() => {});
  }, [code]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (copies.length === 0) return null;

  const query = text.trim().toLowerCase();
  const matches = (
    query ? shelves.filter((s) => s.name.toLowerCase().includes(query) || s.code?.toLowerCase().includes(query)) : shelves
  ).slice(0, 8);

  function onTextChange(value: string) {
    setText(value);
    // A shelf barcode scan types its exact code and sends Enter with no chance to click a
    // row first, so an exact (case-insensitive) match on code or name selects itself as soon
    // as it's typed -- same rule ShelfCombobox uses for the Scan station.
    const q = value.trim().toLowerCase();
    const exact = q ? shelves.find((s) => s.code?.toLowerCase() === q || s.name.toLowerCase() === q) : null;
    setShelf(exact ?? null);
  }

  function pick(s: ShelfSummary) {
    setShelf(s);
    setText(s.name);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shelf) return;
    setBusy(true);
    setError(null);

    const results = await Promise.allSettled(
      copies.map((c) =>
        fetch(`/api/${code}/copies/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shelfId: shelf.id }),
        })
      )
    );

    setBusy(false);
    const failed = results.some((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
    if (failed) {
      setError("Some of these couldn't be moved — please try again.");
      router.refresh();
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-[400px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]"
      >
        <div className="mb-4 border-b border-line pb-[10px] font-mono text-[10px] tracking-[.14em] text-ink-soft uppercase">
          Shelf
        </div>
        <h2 className="mb-1 font-display text-2xl leading-[1.2] font-semibold text-ink">Move to shelf</h2>
        <p className="mb-4 font-sans text-sm leading-[1.55] text-ink-soft">
          {bulk ? `Move ${copies.length} books to a different shelf.` : `Move “${copies[0].book.title}” to a different shelf.`}
        </p>

        <div className="mb-4">
          <label htmlFor="moveShelfInput" className={formLabelClass}>
            Shelf
          </label>
          <input
            id="moveShelfInput"
            ref={inputRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && shelf) {
                e.preventDefault();
                submit(e);
              }
            }}
            placeholder="Search by name or code…"
            autoComplete="off"
            disabled={busy}
            className="w-full rounded-t-[2px] border border-line-strong bg-surface px-3 py-2.5 font-mono text-[13.5px] text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
          />
          <ul className="max-h-[190px] overflow-y-auto rounded-b-[2px] border border-t-0 border-line-strong">
            {matches.length === 0 ? (
              <li className="px-3 py-2.5 font-sans text-[12.5px] text-ink-faint">No shelf matches &ldquo;{text}&rdquo;</li>
            ) : (
              matches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => pick(s)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left font-sans text-[13.5px] hover:bg-chip-hover ${
                      shelf?.id === s.id ? "bg-pill-available-bg text-pill-available-fg" : "text-ink"
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
        </div>

        {error && <p className="mb-3 font-mono text-xs text-accent">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !shelf}
            className="rounded-[2px] bg-accent px-3 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
