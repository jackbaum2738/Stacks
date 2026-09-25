"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { PersonCombobox, type PersonSummary } from "@/components/person-combobox";
import { useLibraryRole } from "@/components/library-role-context";

interface CopyRowData {
  id: string;
  status: "AVAILABLE" | "RESERVED" | "REMOVED";
  shelf: { id: string; name: string } | null;
  book: { title: string; authors: string[]; coverUrl: string | null };
  reservation: { id: string; person: PersonSummary | null; note: string | null } | null;
}

export function CopyRow({
  copy,
  code,
  showShelf = true,
  onUpdated,
}: {
  copy: CopyRowData;
  code: string;
  showShelf?: boolean;
  /** Called after a successful reserve/release/remove, for pages whose data isn't server-rendered (router.refresh() alone won't update those). */
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const { canEdit } = useLibraryRole();
  const [showReserveForm, setShowReserveForm] = useState(false);
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/${code}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyId: copy.id, personId: person.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setShowReserveForm(false);
    setPerson(null);
    router.refresh();
    onUpdated?.();
  }

  async function release() {
    if (!copy.reservation) return;
    setBusy(true);
    await fetch(`/api/${code}/reservations/${copy.reservation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ release: true }),
    });
    setBusy(false);
    router.refresh();
    onUpdated?.();
  }

  async function remove() {
    if (!window.confirm(`Remove "${copy.book.title}" from your library?`)) return;
    setBusy(true);
    await fetch(`/api/${code}/copies/${copy.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
    onUpdated?.();
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex gap-3">
          <BookCover src={copy.book.coverUrl} alt={copy.book.title} className="h-16 w-12 flex-shrink-0" />
          <div className="min-w-0 flex-1 sm:hidden">
            <p className="truncate font-display font-medium text-ink">{copy.book.title}</p>
            <p className="truncate font-sans text-sm text-ink-soft">
              {copy.book.authors.join(", ") || "Unknown author"}
              {showShelf && copy.shelf ? ` · ${copy.shelf.name}` : ""}
            </p>
          </div>
        </div>
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="truncate font-display font-medium text-ink">{copy.book.title}</p>
          <p className="truncate font-sans text-sm text-ink-soft">
            {copy.book.authors.join(", ") || "Unknown author"}
            {showShelf && copy.shelf ? ` · ${copy.shelf.name}` : ""}
          </p>
          {copy.reservation && (
            <p className="font-sans text-sm text-reserved-text">
              Reserved for {copy.reservation.person?.name ?? "someone no longer in your directory"}
              {copy.reservation.person?.email ? ` (${copy.reservation.person.email})` : ""}
            </p>
          )}
        </div>
        {copy.reservation && (
          <p className="rounded-[2px] bg-pill-reserved-bg px-2.5 py-1.5 font-sans text-sm text-reserved-text sm:hidden">
            Reserved for {copy.reservation.person?.name ?? "someone no longer in your directory"}
            {copy.reservation.person?.email ? ` (${copy.reservation.person.email})` : ""}
          </p>
        )}
        {canEdit && (
          <div className="flex flex-shrink-0 gap-2">
            {copy.status === "AVAILABLE" && !showReserveForm && (
              <button
                onClick={() => setShowReserveForm(true)}
                disabled={busy}
                className="flex-1 rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-ink hover:bg-chip-hover sm:flex-none"
              >
                Reserve
              </button>
            )}
            {copy.status === "RESERVED" && (
              <button
                onClick={release}
                disabled={busy}
                className="flex-1 rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-ink hover:bg-chip-hover sm:flex-none"
              >
                Release
              </button>
            )}
            <button
              onClick={remove}
              disabled={busy}
              className="flex-1 rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-accent hover:bg-chip-hover sm:flex-none"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {canEdit && showReserveForm && (
        <form onSubmit={reserve} className="flex flex-wrap items-center gap-2 border border-line bg-bg p-3">
          <PersonCombobox code={code} selected={person} onChange={setPerson} required />
          <button
            type="submit"
            disabled={busy || !person}
            className="rounded-[2px] bg-ink px-3 py-1.5 font-sans text-sm font-medium text-surface hover:brightness-95 disabled:opacity-50"
          >
            Save
          </button>
          <button type="button" onClick={() => setShowReserveForm(false)} className="font-sans text-sm text-ink-soft">
            Cancel
          </button>
          {error && <p className="w-full font-mono text-xs text-accent">{error}</p>}
        </form>
      )}
    </li>
  );
}
