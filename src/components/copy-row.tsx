"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/book-cover";

interface CopyRowData {
  id: string;
  status: "AVAILABLE" | "RESERVED" | "REMOVED";
  shelf: { id: string; name: string } | null;
  book: { title: string; authors: string[]; coverUrl: string | null };
  reservation: { id: string; reservedFor: string; contact: string | null; note: string | null } | null;
}

export function CopyRow({ copy, showShelf = true }: { copy: CopyRowData; showShelf?: boolean }) {
  const router = useRouter();
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
  }

  async function remove() {
    if (!window.confirm(`Remove "${copy.book.title}" from your library?`)) return;
    setBusy(true);
    await fetch(`/api/copies/${copy.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-center gap-3">
        <BookCover src={copy.book.coverUrl} alt={copy.book.title} className="h-16 w-12 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{copy.book.title}</p>
          <p className="truncate text-sm text-gray-500">
            {copy.book.authors.join(", ") || "Unknown author"}
            {showShelf && copy.shelf ? ` · ${copy.shelf.name}` : ""}
          </p>
          {copy.reservation && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Reserved for {copy.reservation.reservedFor}
              {copy.reservation.contact ? ` (${copy.reservation.contact})` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {copy.status === "AVAILABLE" && !showReserveForm && (
            <button
              onClick={() => setShowReserveForm(true)}
              disabled={busy}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium dark:border-gray-700"
            >
              Reserve
            </button>
          )}
          {copy.status === "RESERVED" && (
            <button
              onClick={release}
              disabled={busy}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium dark:border-gray-700"
            >
              Release
            </button>
          )}
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-red-700 dark:border-gray-700 dark:text-red-400"
          >
            Remove
          </button>
        </div>
      </div>

      {showReserveForm && (
        <form onSubmit={reserve} className="flex flex-wrap items-center gap-2 rounded-md bg-gray-50 p-3 dark:bg-gray-900">
          <input
            value={reservedFor}
            onChange={(e) => setReservedFor(e.target.value)}
            placeholder="Reserved for (name)"
            required
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Contact (optional)"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
          >
            Save
          </button>
          <button type="button" onClick={() => setShowReserveForm(false)} className="text-sm text-gray-500">
            Cancel
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}
    </li>
  );
}
