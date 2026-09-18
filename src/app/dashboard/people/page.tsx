"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLibraryRole } from "@/components/library-role-context";
import { PersonModal, type PersonRecord } from "@/components/person-modal";
import { DeletePersonModal } from "@/components/delete-person-modal";
import { ReservedOverlay, type ReservationCountChange } from "@/components/reserved-overlay";
import { formatDate } from "@/lib/format-date";

type SortKey = "name" | "email" | "phone" | "location" | "birthday" | "reservations";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

function sortVal(p: PersonRecord, key: SortKey): string | number {
  switch (key) {
    case "name":
      return p.name.toLowerCase();
    case "email":
      return (p.email ?? "").toLowerCase();
    case "phone":
      return (p.phone ?? "").toLowerCase();
    case "location":
      return (p.location ?? "").toLowerCase();
    case "birthday":
      return p.birthday ?? "";
    case "reservations":
      return p.activeReservationCount;
  }
}

function compareRows(a: PersonRecord, b: PersonRecord, key: SortKey, dir: 1 | -1): number {
  const av = sortVal(a, key);
  const bv = sortVal(b, key);
  if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
  return collator.compare(String(av), String(bv)) * dir;
}

const HEADERS: { key: SortKey; label: string; className?: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone", className: "hidden sm:table-cell" },
  { key: "location", label: "Location", className: "hidden md:table-cell" },
  { key: "birthday", label: "Birthday", className: "hidden lg:table-cell" },
  { key: "reservations", label: "Reservations" },
];

export default function PeoplePage() {
  const { canEdit } = useLibraryRole();
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [modalPerson, setModalPerson] = useState<PersonRecord | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<PersonRecord | null>(null);
  const [reservedFor, setReservedFor] = useState<string | null>(null);

  const loadPeople = useCallback(() => {
    setLoading(true);
    return fetch("/api/people")
      .then((res) => res.json())
      .then((data) => setPeople(data.people ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // One-time fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPeople();
  }, [loadPeople]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const trimmedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      people.filter(
        (p) => p.name.toLowerCase().includes(trimmedQuery) || (p.email ?? "").toLowerCase().includes(trimmedQuery)
      ),
    [people, trimmedQuery]
  );
  const sorted = useMemo(() => [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDir)), [filtered, sortKey, sortDir]);

  function onSaved(person: PersonRecord) {
    setModalPerson(null);
    setPeople((prev) => {
      const exists = prev.some((p) => p.id === person.id);
      return exists ? prev.map((p) => (p.id === person.id ? person : p)) : [...prev, person];
    });
  }

  function onDeleted(id: string) {
    setModalPerson(null);
    setDeleteTarget(null);
    setPeople((prev) => prev.filter((p) => p.id !== id));
  }

  const openPerson = modalPerson === "new" ? null : modalPerson;
  const modalOpen = modalPerson !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] font-semibold text-ink">People</h1>
          <p className="font-sans text-sm text-ink-soft">Everyone books get reserved for, in one directory. Only a name is required.</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setModalPerson("new")}
            className="rounded-[2px] bg-accent px-4 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95"
          >
            + Add person
          </button>
        )}
      </div>

      <div className="flex items-center gap-[10px] border border-line-strong bg-surface px-[15px] py-[13px]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[17px] w-[17px] flex-shrink-0 text-ink-faint">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none"
        />
      </div>

      {loading && <p className="font-sans text-sm text-ink-soft">Loading…</p>}

      {!loading && sorted.length === 0 && (
        <p className="font-sans text-sm text-ink-soft">
          {trimmedQuery ? `No people match “${query.trim()}”.` : "No people in your directory yet."}
        </p>
      )}

      {!loading && sorted.length > 0 && (
        <div className="space-y-2 sm:hidden">
          {sorted.map((person) => (
            <div
              key={person.id}
              onClick={() => setModalPerson(person)}
              className="flex cursor-pointer items-center gap-3 border border-line bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-sans font-semibold text-ink">{person.name}</p>
                <p className={`truncate font-sans text-xs ${person.email ? "text-ink-soft" : "text-ink-faint italic"}`}>
                  {person.email || "No email"}
                </p>
              </div>
              {person.activeReservationCount > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReservedFor(person.name);
                  }}
                  className="flex-shrink-0 rounded-[2px] bg-[var(--pill-reserved-bg)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--pill-reserved-fg)] underline underline-offset-2 hover:brightness-95"
                >
                  {person.activeReservationCount} active
                </button>
              ) : (
                <span className="flex-shrink-0 rounded-[2px] bg-line-inner px-2 py-0.5 font-mono text-[10.5px] text-ink-faint">none</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(person);
                  }}
                  title="Remove person"
                  aria-label={`Remove ${person.name}`}
                  className="flex-shrink-0 rounded-[2px] p-1.5 text-ink-faint hover:bg-chip-hover hover:text-accent"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="hidden overflow-x-auto border border-line bg-surface sm:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                {HEADERS.map((h) => (
                  <th
                    key={h.key}
                    className={`${h.className ?? ""} py-2 pr-3 pl-4 first:pl-4`}
                    aria-sort={sortKey === h.key ? (sortDir === 1 ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(h.key)}
                      className="inline-flex items-center gap-1 py-2 font-mono text-[10px] font-medium tracking-[.14em] text-ink-muted uppercase hover:text-ink"
                    >
                      {h.label}
                      {sortKey === h.key && <span className="text-[9px]">{sortDir === 1 ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                ))}
                {canEdit && <th className="w-[42px] py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((person) => (
                <tr
                  key={person.id}
                  onClick={() => setModalPerson(person)}
                  className="cursor-pointer border-b border-line-inner hover:bg-row-hover"
                >
                  <td className="py-2.5 pr-3 pl-4 font-sans font-semibold whitespace-nowrap text-ink">{person.name}</td>
                  <td className={`py-2.5 pr-3 font-sans ${person.email ? "text-ink-soft" : "text-ink-faint italic"}`}>
                    {person.email || "—"}
                  </td>
                  <td className={`hidden py-2.5 pr-3 font-sans sm:table-cell ${person.phone ? "text-ink-soft" : "text-ink-faint italic"}`}>
                    {person.phone || "—"}
                  </td>
                  <td className={`hidden py-2.5 pr-3 font-sans md:table-cell ${person.location ? "text-ink-soft" : "text-ink-faint italic"}`}>
                    {person.location || "—"}
                  </td>
                  <td className={`hidden py-2.5 pr-3 font-mono text-[12px] lg:table-cell ${person.birthday ? "text-ink-soft" : "text-ink-faint italic"}`}>
                    {person.birthday ? formatDate(person.birthday) : "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    {person.activeReservationCount > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReservedFor(person.name);
                        }}
                        className="rounded-[2px] bg-[var(--pill-reserved-bg)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--pill-reserved-fg)] underline underline-offset-2 hover:brightness-95"
                      >
                        {person.activeReservationCount} active
                      </button>
                    ) : (
                      <span className="rounded-[2px] bg-line-inner px-2 py-0.5 font-mono text-[10.5px] text-ink-faint">none</span>
                    )}
                  </td>
                  {canEdit && (
                    <td onClick={(e) => e.stopPropagation()} className="py-2.5 pr-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(person)}
                        title="Remove person"
                        aria-label={`Remove ${person.name}`}
                        className="rounded-[2px] p-1.5 text-ink-faint hover:bg-chip-hover hover:text-accent"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <PersonModal
          person={openPerson}
          canEdit={canEdit}
          onClose={() => setModalPerson(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
      {deleteTarget && (
        <DeletePersonModal
          person={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDone={() => onDeleted(deleteTarget.id)}
        />
      )}
      {reservedFor && (
        <ReservedOverlay
          initialFilter={reservedFor}
          onClose={(changedCounts: ReservationCountChange[]) => {
            setReservedFor(null);
            if (changedCounts.length > 0) {
              setPeople((prev) =>
                prev.map((p) => {
                  const change = changedCounts.find((c) => c.personId === p.id);
                  return change ? { ...p, activeReservationCount: change.activeReservationCount } : p;
                })
              );
            }
          }}
        />
      )}
    </div>
  );
}
