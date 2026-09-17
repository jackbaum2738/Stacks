"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { StatusPill } from "@/components/status-pill";
import { ReservationModal } from "@/components/reservation-modal";
import { DeleteCopiesModal } from "@/components/delete-copies-modal";
import { LibrarySelectionBar } from "@/components/library-selection-bar";
import { LibraryContextMenu, type ContextMenuTarget } from "@/components/library-context-menu";
import { formatDate } from "@/lib/format-date";
import { useLibraryRole } from "@/components/library-role-context";

interface BookResult {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  copies: {
    id: string;
    status: "AVAILABLE" | "RESERVED" | "REMOVED";
    addedAt: string;
    shelf: { id: string; name: string } | null;
    reservation: { id: string; reservedFor: string; contact: string | null; note: string | null } | null;
  }[];
}

interface Row {
  id: string;
  status: "AVAILABLE" | "RESERVED" | "REMOVED";
  addedAt: string;
  shelf: { id: string; name: string } | null;
  reservation: { id: string; reservedFor: string; contact: string | null } | null;
  book: { title: string; authors: string[]; coverUrl: string | null };
}

type SortKey = "title" | "author" | "shelf" | "added" | "status";

const VIEW_MODE_KEY = "stacks:library-view-mode";
const collator = new Intl.Collator(undefined, { sensitivity: "base" });

function toModalCopy(row: Row) {
  return { id: row.id, book: { title: row.book.title }, reservation: row.reservation };
}

function compareRows(a: Row, b: Row, key: SortKey, dir: 1 | -1): number {
  switch (key) {
    case "title":
      return collator.compare(a.book.title, b.book.title) * dir;
    case "author":
      return collator.compare(a.book.authors.join(", "), b.book.authors.join(", ")) * dir;
    case "shelf":
      return collator.compare(a.shelf?.name ?? "", b.shelf?.name ?? "") * dir;
    case "added":
      return (new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()) * dir;
    case "status":
      if (a.status !== b.status) return (a.status === "RESERVED" ? 1 : -1) * dir;
      return collator.compare(a.reservation?.reservedFor ?? "", b.reservation?.reservedFor ?? "") * dir;
  }
}

export default function LibraryBrowsePage() {
  const router = useRouter();
  const { canEdit } = useLibraryRole();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reserveModal, setReserveModal] = useState<{ mode: "create" | "edit"; rows: Row[] } | null>(null);
  const [deleteModal, setDeleteModal] = useState<Row[] | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);

  const runSearch = useCallback((q: string) => {
    return fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((res) => res.json())
      .then((data) => setBooks(data.books ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(timeout);
  }, [query, runSearch]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      // One-time sync from an external store (localStorage) on mount, deliberately after
      // the default-state first render so server and client agree on the initial paint.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "list" || stored === "grid") setViewMode(stored);
    } catch {
      // localStorage unavailable — fall back to default view
    }
  }, []);

  function changeViewMode(mode: "list" | "grid") {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // ignore — per-viewer convenience only
    }
  }

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  function onQueryChange(value: string) {
    setQuery(value);
    setLoading(true);
  }

  const rows = useMemo<Row[]>(
    () => books.flatMap((book) => book.copies.map((copy) => ({ ...copy, book }))),
    [books]
  );
  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDir)),
    [rows, sortKey, sortDir]
  );

  function onFinished() {
    setSelected(new Set());
    setReserveModal(null);
    setDeleteModal(null);
    runSearch(query);
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const selectedRows = useMemo(() => [...selected].map((id) => rowsById.get(id)).filter((r): r is Row => !!r), [selected, rowsById]);
  const anySelectedReserved = selectedRows.some((r) => r.reservation);

  function openRowReserve(row: Row) {
    setReserveModal({ mode: row.reservation ? "edit" : "create", rows: [row] });
  }

  const trimmedQuery = query.trim();
  const headers: { key: SortKey; label: string; className?: string }[] = [
    { key: "title", label: "Title" },
    { key: "author", label: "Author" },
    { key: "shelf", label: "Shelf", className: "hidden sm:table-cell" },
    { key: "added", label: "Date added", className: "hidden md:table-cell" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] font-semibold text-ink">Library</h1>
          {!loading && (
            <p className="font-mono text-[11px] tracking-[.10em] text-ink-soft uppercase">
              {rows.length} {rows.length === 1 ? "book" : "books"} · sorted by {sortKey}
            </p>
          )}
        </div>
        <div className="flex items-center border border-line-strong">
          <button
            type="button"
            aria-pressed={viewMode === "list"}
            aria-label="List view"
            title="List view"
            onClick={() => changeViewMode("list")}
            className={`p-[7px] ${viewMode === "list" ? "bg-ink text-surface" : "text-ink-faint"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-6 w-6">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "grid"}
            aria-label="Grid view"
            title="Grid view"
            onClick={() => changeViewMode("grid")}
            className={`p-[7px] ${viewMode === "grid" ? "bg-ink text-surface" : "text-ink-faint"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-[10px] border border-line-strong bg-surface px-[15px] py-[13px]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[17px] w-[17px] flex-shrink-0 text-ink-faint">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by title, author, ISBN, or BCID — or leave blank to browse everything"
          className="w-full bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none"
        />
      </div>

      {canEdit && selected.size > 0 && (
        <LibrarySelectionBar
          count={selected.size}
          anyReserved={anySelectedReserved}
          onClear={() => setSelected(new Set())}
          onReserve={() => setReserveModal({ mode: "create", rows: selectedRows })}
          onEditReservations={() => setReserveModal({ mode: "edit", rows: selectedRows })}
          onDelete={() => setDeleteModal(selectedRows)}
        />
      )}

      {loading && <p className="font-sans text-sm text-ink-soft">Loading…</p>}

      {!loading && rows.length === 0 && (
        <p className="font-sans text-sm text-ink-soft">
          {trimmedQuery ? "No books found." : "No books in your library yet."}
        </p>
      )}

      {!loading && rows.length > 0 && viewMode === "list" && (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                {canEdit && <th className="w-[42px] py-2 pl-4"></th>}
                <th className={`w-11 py-2 ${canEdit ? "" : "pl-4"}`}></th>
                {headers.map((h) => (
                  <th
                    key={h.key}
                    className={`${h.className ?? ""} pr-3`}
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
                {canEdit && <th className="w-[74px] py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/dashboard/copies/${row.id}`)}
                  className={`cursor-pointer border-b border-line-inner hover:bg-row-hover ${
                    selected.has(row.id) ? "bg-row-hover" : ""
                  }`}
                >
                  {canEdit && (
                    <td onClick={(e) => e.stopPropagation()} className="py-2.5 pl-4">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={(e) => toggleSelect(row.id, e.target.checked)}
                        aria-label={`Select ${row.book.title}`}
                        className="accent-accent"
                      />
                    </td>
                  )}
                  <td className={`py-2.5 ${canEdit ? "" : "pl-4"}`}>
                    <BookCover src={row.book.coverUrl} alt={row.book.title} className="h-[50px] w-[34px]" />
                  </td>
                  <td className="max-w-[240px] truncate py-2.5 font-display text-[16px] font-medium text-ink">
                    {row.book.title}
                  </td>
                  <td className="max-w-[170px] truncate py-2.5 font-sans text-ink-soft">
                    {row.book.authors.join(", ") || "Unknown author"}
                  </td>
                  <td className="hidden truncate py-2.5 font-mono text-[13px] text-ink sm:table-cell">
                    {row.shelf?.name ?? "—"}
                  </td>
                  <td className="hidden py-2.5 font-mono text-[12px] text-ink-soft md:table-cell">
                    {formatDate(row.addedAt)}
                  </td>
                  <td className="py-2.5">
                    <StatusPill status={row.status} />
                    {row.reservation && (
                      <span className="mt-1 block font-sans text-xs text-reserved-text">
                        {row.reservation.reservedFor}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td onClick={(e) => e.stopPropagation()} className="py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openRowReserve(row)}
                          title={row.reservation ? "Edit reservation" : "Reserve"}
                          aria-label={`${row.reservation ? "Edit reservation for" : "Reserve"} ${row.book.title}`}
                          className={`rounded-[2px] p-1.5 hover:bg-chip-hover ${row.reservation ? "text-pill-reserved-fg" : "text-ink-faint"}`}
                        >
                          <svg viewBox="0 0 24 24" fill={row.reservation ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-4 w-4">
                            <path d="M7 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16l-5-3.2L7 20V4z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModal([row])}
                          title="Remove from library"
                          aria-label={`Remove ${row.book.title}`}
                          className="rounded-[2px] p-1.5 text-ink-faint hover:bg-chip-hover hover:text-accent"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-2 gap-x-[26px] gap-y-[30px] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sortedRows.map((row) => (
            <div key={row.id} className="space-y-[7px]">
              <div
                className="group relative cursor-pointer"
                onClick={() => router.push(`/dashboard/copies/${row.id}`)}
                onContextMenu={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setContextMenu({ id: row.id, title: row.book.title, x: e.clientX, y: e.clientY, reserved: !!row.reservation });
                }}
              >
                <BookCover src={row.book.coverUrl} alt={row.book.title} className="aspect-[2/3] w-full" />
                {canEdit && (
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-[2px] bg-surface/90 shadow ${
                      selected.has(row.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={(e) => toggleSelect(row.id, e.target.checked)}
                      aria-label={`Select ${row.book.title}`}
                      className="accent-accent"
                    />
                  </label>
                )}
              </div>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/copies/${row.id}`)}
                className="block w-full truncate text-left font-display text-[15px] font-medium text-ink hover:underline"
              >
                {row.book.title}
              </button>
              <p className="truncate font-sans text-xs text-ink-soft">
                {row.book.authors.join(", ") || "Unknown author"}
              </p>
              <div className="flex items-center justify-between font-mono text-[11px] text-ink-faint">
                <span className="truncate">{row.shelf?.name ?? "No shelf"}</span>
                <span className="flex-shrink-0">{formatDate(row.addedAt)}</span>
              </div>
              {row.reservation && (
                <p className="truncate font-sans text-xs text-reserved-text">
                  Reserved — {row.reservation.reservedFor}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {contextMenu && (
        <LibraryContextMenu
          target={contextMenu}
          onOpen={() => router.push(`/dashboard/copies/${contextMenu.id}`)}
          onReserve={() => {
            const row = rowsById.get(contextMenu.id);
            setContextMenu(null);
            if (row) openRowReserve(row);
          }}
          onDelete={() => {
            const row = rowsById.get(contextMenu.id);
            setContextMenu(null);
            if (row) setDeleteModal([row]);
          }}
        />
      )}

      {reserveModal && (
        <ReservationModal
          mode={reserveModal.mode}
          copies={reserveModal.rows.map(toModalCopy)}
          onClose={() => setReserveModal(null)}
          onDone={onFinished}
        />
      )}
      {deleteModal && (
        <DeleteCopiesModal copies={deleteModal.map(toModalCopy)} onClose={() => setDeleteModal(null)} onDone={onFinished} />
      )}
    </div>
  );
}
