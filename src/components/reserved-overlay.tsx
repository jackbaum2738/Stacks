"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { ReservationModal } from "@/components/reservation-modal";
import { useLibraryRole } from "@/components/library-role-context";
import { formatDate } from "@/lib/format-date";
import type { PersonSummary } from "@/components/person-combobox";

export interface ReservationCountChange {
  personId: string;
  activeReservationCount: number;
}

function countsByPerson(reservations: { person: PersonSummary | null }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of reservations) {
    if (!r.person) continue;
    counts[r.person.id] = (counts[r.person.id] ?? 0) + 1;
  }
  return counts;
}

type SortKey = "book" | "person" | "shelf" | "date";

interface ReservationRow {
  id: string;
  createdAt: string;
  copy: {
    id: string;
    book: { title: string; authors: string[]; coverUrl: string | null };
    shelf: { name: string } | null;
  };
  person: PersonSummary | null;
}

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

function sortVal(r: ReservationRow, key: SortKey): string {
  switch (key) {
    case "book":
      return r.copy.book.title.toLowerCase();
    case "person":
      return (r.person?.name ?? "").toLowerCase();
    case "shelf":
      return (r.copy.shelf?.name ?? "").toLowerCase();
    case "date":
      return r.createdAt;
  }
}

const HEADERS: { key: SortKey; label: string }[] = [
  { key: "book", label: "Book" },
  { key: "person", label: "Reserved for" },
  { key: "shelf", label: "Shelf" },
  { key: "date", label: "Reserved on" },
];

/**
 * Every active reservation in the library, opened from a person's count in the People
 * table (see PeoplePage). The filter defaults to that person's name but stays editable,
 * so clearing it browses every reservation at once -- the point of a "person" here is
 * batching a few books together before mailing them, not a per-person silo.
 */
export function ReservedOverlay({
  initialFilter,
  onClose,
}: {
  initialFilter: string;
  onClose: (changedCounts: ReservationCountChange[]) => void;
}) {
  const { canEdit } = useLibraryRole();
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(initialFilter);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [editTarget, setEditTarget] = useState<ReservationRow | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const initialCountsRef = useRef<Record<string, number> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    return fetch("/api/reservations")
      .then((res) => res.json())
      .then((data) => {
        const rows: ReservationRow[] = data.reservations ?? [];
        setReservations(rows);
        if (!initialCountsRef.current) initialCountsRef.current = countsByPerson(rows);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // One-time fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function handleClose() {
    const before = initialCountsRef.current ?? {};
    const after = countsByPerson(reservations);
    const changed: ReservationCountChange[] = [];
    for (const personId of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const prevCount = before[personId] ?? 0;
      const nextCount = after[personId] ?? 0;
      if (prevCount !== nextCount) changed.push({ personId, activeReservationCount: nextCount });
    }
    onClose(changed);
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const trimmedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => reservations.filter((r) => (r.person?.name ?? "").toLowerCase().includes(trimmedQuery)),
    [reservations, trimmedQuery]
  );
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => collator.compare(sortVal(a, sortKey), sortVal(b, sortKey)) * sortDir),
    [filtered, sortKey, sortDir]
  );

  async function release(reservation: ReservationRow) {
    setReleasingId(reservation.id);
    await fetch(`/api/reservations/${reservation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ release: true }),
    });
    setReleasingId(null);
    load();
  }

  return (
    <div
      id="reserved-overlay"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(43,38,32,.45)] p-4 pt-10"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="w-full max-w-[720px] rounded-[2px] border border-line-strong bg-surface p-[26px] shadow-[0_24px_44px_rgba(43,38,32,.3)]">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-ink">Reserved</h2>
          <button type="button" onClick={handleClose} aria-label="Close" className="text-2xl leading-none text-ink-soft hover:text-ink">
            &times;
          </button>
        </div>
        <p className="mb-4 max-w-[56ch] font-sans text-sm leading-[1.55] text-ink-soft">
          Held for someone until it&rsquo;s worth the postage to send &mdash; reserving a few books for the same person
          before mailing them together is the whole point. Release one if plans change.
        </p>

        <div className="mb-4 flex items-center gap-[10px] border border-line-strong bg-surface px-[15px] py-[13px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[17px] w-[17px] flex-shrink-0 text-ink-faint">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by person…"
            className="w-full bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none"
          />
        </div>

        {loading && <p className="font-sans text-sm text-ink-soft">Loading…</p>}

        {!loading && sorted.length === 0 && (
          <p className="py-6 text-center font-sans text-sm text-ink-soft">
            {trimmedQuery ? `No reservations match “${query.trim()}”.` : "No active reservations."}
          </p>
        )}

        {!loading && sorted.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-ink text-left">
                  {HEADERS.map((h) => (
                    <th key={h.key} className="py-2 pr-3 first:pl-0" aria-sort={sortKey === h.key ? (sortDir === 1 ? "ascending" : "descending") : "none"}>
                      <button
                        type="button"
                        onClick={() => toggleSort(h.key)}
                        className="inline-flex items-center gap-1 font-mono text-[10px] font-medium tracking-[.14em] text-ink-muted uppercase hover:text-ink"
                      >
                        {h.label}
                        {sortKey === h.key && <span className="text-[9px]">{sortDir === 1 ? "▲" : "▼"}</span>}
                      </button>
                    </th>
                  ))}
                  {canEdit && <th className="py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b border-line-inner">
                    <td className="py-2.5 pr-3 first:pl-0">
                      <div className="flex items-center gap-2.5">
                        <BookCover src={r.copy.book.coverUrl} alt={r.copy.book.title} className="h-[42px] w-[30px] flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate font-sans font-semibold text-ink">{r.copy.book.title}</div>
                          <div className="truncate font-sans text-xs text-ink-soft">{r.copy.book.authors.join(", ") || "Unknown author"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-sans">
                      <div className="text-ink">{r.person?.name ?? "Someone no longer in your directory"}</div>
                      {r.person?.email && <div className="text-xs text-ink-faint">{r.person.email}</div>}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-ink-soft">{r.copy.shelf?.name ?? "—"}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-ink-soft">{formatDate(r.createdAt)}</td>
                    {canEdit && (
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditTarget(r)}
                          className="rounded-[2px] border border-line-strong px-2.5 py-1 font-sans text-xs font-medium text-ink hover:bg-chip-hover"
                        >
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          onClick={() => release(r)}
                          disabled={releasingId === r.id}
                          className="rounded-[2px] border border-line-strong px-2.5 py-1 font-sans text-xs font-medium text-ink hover:bg-chip-hover disabled:opacity-50"
                        >
                          Release
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editTarget && (
        <ReservationModal
          mode="edit"
          copies={[
            {
              id: editTarget.copy.id,
              book: { title: editTarget.copy.book.title },
              reservation: { id: editTarget.id, person: editTarget.person },
            },
          ]}
          onClose={() => setEditTarget(null)}
          onDone={() => {
            setEditTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}
