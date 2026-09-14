"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PersonCombobox } from "@/components/person-combobox";

interface ModalCopy {
  id: string;
  book: { title: string };
  reservation: { id: string; reservedFor: string; contact: string | null } | null;
}

function commonValue(copies: ModalCopy[], key: "reservedFor" | "contact"): string {
  const values = new Set(copies.map((c) => (c.reservation?.[key] ?? "") || ""));
  return values.size === 1 ? [...values][0] : "";
}

/**
 * Handles both creating a new reservation and editing existing ones, for a single copy
 * or a whole selection at once. In "edit" mode, targets are narrowed to the copies that
 * are actually reserved (so a mixed selection is handled sensibly).
 */
export function ReservationModal({
  mode,
  copies,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  copies: ModalCopy[];
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const targets = mode === "edit" ? copies.filter((c) => c.reservation) : copies;
  const bulk = targets.length > 1;

  const [reservedFor, setReservedFor] = useState(mode === "edit" ? commonValue(targets, "reservedFor") : "");
  const [contact, setContact] = useState(mode === "edit" ? commonValue(targets, "contact") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (targets.length === 0) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = reservedFor.trim();
    if (!name) return;
    setBusy(true);
    setError(null);

    const results = await Promise.allSettled(
      targets.map((c) =>
        c.reservation
          ? fetch(`/api/reservations/${c.reservation.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reservedFor: name, contact: contact || null }),
            })
          : fetch("/api/reservations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ copyId: c.id, reservedFor: name, contact: contact || undefined }),
            })
      )
    );

    setBusy(false);
    const failed = results.some((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
    if (failed) {
      setError("Some of these couldn't be updated — please try again.");
      router.refresh();
      return;
    }
    onDone();
    router.refresh();
  }

  async function removeReservations() {
    setBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      targets
        .filter((c) => c.reservation)
        .map((c) =>
          fetch(`/api/reservations/${c.reservation!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ release: true }),
          })
        )
    );
    setBusy(false);
    const failed = results.some((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
    if (failed) {
      setError("Some reservations couldn't be removed — please try again.");
      router.refresh();
      return;
    }
    onDone();
    router.refresh();
  }

  const heading =
    mode === "edit"
      ? `Edit reservation${bulk ? "s" : ""}`
      : bulk
        ? `Reserve ${targets.length} books`
        : `Reserve “${targets[0].book.title}”`;

  const subheading =
    mode === "edit"
      ? bulk
        ? `Editing ${targets.length} reservations${
            reservedFor ? ` — all currently for ${reservedFor}` : " for different people"
          }. Saving applies the name below to all of them.`
        : `Change who “${targets[0].book.title}” is reserved for, or remove the reservation.`
      : `Hold ${bulk ? "these books" : "this book"} for a specific person until you're ready to send ${bulk ? "them" : "it"}.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="mb-1 text-base font-semibold">{heading}</h2>
        <p className="mb-4 text-sm text-gray-500">{subheading}</p>

        <div className="mb-3 space-y-1">
          <label htmlFor="reservationModalName" className="text-sm font-medium">
            Reserved for
          </label>
          <PersonCombobox
            id="reservationModalName"
            value={reservedFor}
            onChange={setReservedFor}
            required
            placeholder="e.g. Hans in Germany"
          />
        </div>

        <div className="mb-4 space-y-1">
          <label htmlFor="reservationModalContact" className="text-sm font-medium">
            Contact (optional)
          </label>
          <input
            id="reservationModalContact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email or note"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className={`flex items-center ${mode === "edit" ? "justify-between" : "justify-end"} gap-2`}>
          {mode === "edit" && (
            <button
              type="button"
              onClick={removeReservations}
              disabled={busy}
              className="text-sm font-medium text-red-700 hover:underline dark:text-red-400"
            >
              Remove reservation{bulk ? "s" : ""}
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
            >
              {mode === "edit" ? "Save changes" : "Reserve"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
