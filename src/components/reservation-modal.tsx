"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PersonCombobox, type PersonSummary } from "@/components/person-combobox";
import { formLabelClass } from "@/lib/form-styles";

interface ModalCopy {
  id: string;
  book: { title: string };
  reservation: { id: string; person: PersonSummary | null } | null;
}

function commonPerson(copies: ModalCopy[]): PersonSummary | null {
  const ids = new Set(copies.map((c) => c.reservation?.person?.id ?? ""));
  if (ids.size !== 1) return null;
  return copies[0]?.reservation?.person ?? null;
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

  const [person, setPerson] = useState<PersonSummary | null>(mode === "edit" ? commonPerson(targets) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (targets.length === 0) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return;
    setBusy(true);
    setError(null);

    const results = await Promise.allSettled(
      targets.map((c) =>
        c.reservation
          ? fetch(`/api/reservations/${c.reservation.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ personId: person.id }),
            })
          : fetch("/api/reservations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ copyId: c.id, personId: person.id }),
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
            person ? ` — all currently for ${person.name}` : " for different people"
          }. Saving applies the person below to all of them.`
        : `Change who “${targets[0].book.title}” is reserved for, or remove the reservation.`
      : `Hold ${bulk ? "these books" : "this book"} for a specific person until you're ready to send ${bulk ? "them" : "it"}.`;

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
          Reservation
        </div>
        <h2 className="mb-1 font-display text-2xl leading-[1.2] font-semibold text-ink">{heading}</h2>
        <p className="mb-4 font-sans text-sm leading-[1.55] text-ink-soft">{subheading}</p>

        <div className="mb-4 space-y-1">
          <label htmlFor="reservationModalName" className={formLabelClass}>
            Reserved for
          </label>
          <PersonCombobox
            id="reservationModalName"
            selected={person}
            onChange={setPerson}
            required
            placeholder="e.g. Hans Richter"
          />
        </div>

        {error && <p className="mb-3 font-mono text-xs text-accent">{error}</p>}

        <div className={`flex items-center ${mode === "edit" ? "justify-between" : "justify-end"} gap-2`}>
          {mode === "edit" && (
            <button
              type="button"
              onClick={removeReservations}
              disabled={busy}
              className="font-sans text-sm font-medium text-accent hover:underline"
            >
              Remove reservation{bulk ? "s" : ""}
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !person}
              className="rounded-[2px] bg-accent px-3 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
            >
              {mode === "edit" ? "Save changes" : "Reserve"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
