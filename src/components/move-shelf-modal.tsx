"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShelfCombobox, type ShelfSummary } from "@/components/shelf-combobox";
import { formLabelClass } from "@/lib/form-styles";

interface ModalCopy {
  id: string;
  book: { title: string };
}

/** Moves one or more copies to a different shelf, for a single copy (book detail, or a
 * per-row/tile trigger) or a whole bulk selection at once. Reuses ShelfCombobox -- the same
 * name-or-code search already built for the Scan station -- rather than a plain <select>. */
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
  const [shelf, setShelf] = useState<ShelfSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/${code}/shelves`)
      .then((res) => res.json())
      .then((data) => setShelves((data.shelves ?? []).map((s: ShelfSummary) => ({ id: s.id, name: s.name, code: s.code }))))
      .catch(() => {});
  }, [code]);

  if (copies.length === 0) return null;

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

        <div className="mb-4 space-y-1">
          <label htmlFor="moveShelfInput" className={formLabelClass}>
            Shelf
          </label>
          <ShelfCombobox id="moveShelfInput" shelves={shelves} selected={shelf} onChange={setShelf} placeholder="Search by name or code…" />
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
