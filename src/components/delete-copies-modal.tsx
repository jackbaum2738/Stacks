"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModalCopy {
  id: string;
  book: { title: string };
  reservation: { person: { name: string } | null } | null;
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
        ? `“${copies[0].book.title}” is reserved for ${copies[0].reservation.person?.name ?? "someone no longer in your directory"}. Remove it from your library anyway?`
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,38,32,.45)] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[400px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
        <h2 className="mb-2 font-display text-2xl font-semibold text-ink">
          Remove {copies.length > 1 ? "books" : "book"}?
        </h2>
        <p className="mb-5 font-sans text-sm leading-[1.55] text-ink-soft">{message}</p>
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
            type="button"
            onClick={confirm}
            disabled={busy}
            className="rounded-[2px] bg-accent px-3 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
