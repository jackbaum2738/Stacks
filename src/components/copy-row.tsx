"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { PersonCombobox } from "@/components/person-combobox";
import { useLibraryRole } from "@/components/library-role-context";

interface CopyRowData {
  id: string;
  status: "AVAILABLE" | "RESERVED" | "REMOVED";
  shelf: { id: string; name: string } | null;
  book: { title: string; authors: string[]; coverUrl: string | null };
  reservation: { id: string; reservedFor: string; contact: string | null; note: string | null } | null;
}

export function CopyRow({
  copy,
  showShelf = true,
  onUpdated,
}: {
  copy: CopyRowData;
  showShelf?: boolean;
  /** Called after a successful reserve/release/remove, for pages whose data isn't server-rendered (router.refresh() alone won't update those). */
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const { canEdit } = useLibraryRole();
  const [showReserveForm, setShowReserveForm] = useState(false);
  const [reservedFor, setReservedFor] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyId: copy.id, reservedFor, contact: contact || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setShowReserveForm(false);
    setReservedFor("");
    setContact("");
    router.refresh();
    onUpdated?.();
  }

  async function release() {
    if (!copy.reservation) return;
    setBusy(true);
    await fetch(`/api/reservations/${copy.reservation.id}`, {
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
    await fetch(`/api/copies/${copy.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
    onUpdated?.();
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-center gap-3">
        <BookCover src={copy.book.coverUrl} alt={copy.book.title} className="h-16 w-12 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-medium text-ink">{copy.book.title}</p>
          <p className="truncate font-sans text-sm text-ink-soft">
            {copy.book.authors.join(", ") || "Unknown author"}
            {showShelf && copy.shelf ? ` · ${copy.shelf.name}` : ""}
          </p>
          {copy.reservation && (
            <p className="font-sans text-sm text-reserved-text">
              Reserved for {copy.reservation.reservedFor}
              {copy.reservation.contact ? ` (${copy.reservation.contact})` : ""}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-shrink-0 gap-2">
            {copy.status === "AVAILABLE" && !showReserveForm && (
              <button
                onClick={() => setShowReserveForm(true)}
                disabled={busy}
                className="rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
              >
                Reserve
              </button>
            )}
            {copy.status === "RESERVED" && (
              <button
                onClick={release}
                disabled={busy}
                className="rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
              >
                Release
              </button>
            )}
            <button
              onClick={remove}
              disabled={busy}
              className="rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-accent hover:bg-chip-hover"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {canEdit && showReserveForm && (
        <form onSubmit={reserve} className="flex flex-wrap items-center gap-2 border border-line bg-bg p-3">
          <PersonCombobox value={reservedFor} onChange={setReservedFor} required />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Contact (optional)"
            className="min-w-0 flex-1 border-b border-line-strong bg-transparent px-0.5 py-1.5 font-sans text-sm text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-[2px] bg-ink px-3 py-1.5 font-sans text-sm font-medium text-surface hover:brightness-95"
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
