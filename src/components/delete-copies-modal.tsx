"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModalCopy {
  id: string;
  book: { title: string };
  reservation: { reservedFor: string } | null;
}

export function DeleteCopiesModal({
  copies,
  onClose,
  onDone,
}: {
  copies: ModalCopy[];
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (copies.length === 0) return null;
  const reservedOnes = copies.filter((c) => c.reservation);

  const message =
    copies.length === 1
      ? copies[0].reservation
        ? `“${copies[0].book.title}” is reserved for ${copies[0].reservation.reservedFor}. Remove it from your library anyway?`
        : `Remove “${copies[0].book.title}” from your library?`
      : reservedOnes.length > 0
        ? `Remove ${copies.length} books from your library? ${reservedOnes.length} of them ${reservedOnes.length === 1 ? "is" : "are"} currently reserved for someone.`
        : `Remove ${copies.length} books from your library?`;

  async function confirm() {
    setBusy(true);
    setError(null);
    const results = await Promise.allSettled(copies.map((c) => fetch(`/api/copies/${c.id}`, { method: "DELETE" })));
    setBusy(false);
    const failed = results.some((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
    if (failed) {
      setError("Some of these couldn't be removed — please try again.");
      router.refresh();
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-2 text-base font-semibold">Remove {copies.length > 1 ? "books" : "book"}?</h2>
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">{message}</p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
