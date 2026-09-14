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
          <h1 className="text-2xl font-bold">Library</h1>
          {!loading && (
            <p className="text-sm text-gray-500">
              {rows.length} {rows.length === 1 ? "book" : "books"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-md border border-gray-300 p-0.5 dark:border-gray-700">
          <button
            type="button"
            aria-pressed={viewMode === "list"}
            aria-label="List view"
            title="List view"
            onClick={() => changeViewMode("list")}
            className={`rounded p-1.5 ${viewMode === "list" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-500"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
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
            className={`rounded p-1.5 ${viewMode === "grid" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-500"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      <input
        autoFocus
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by title, author, or ISBN — or leave blank to browse everything"
        className="w-full rounded-md border border-gray-300 px-3 py-3 text-lg dark:border-gray-700 dark:bg-gray-900"
      />

      {selected.size > 0 && (
        <LibrarySelectionBar
          count={selected.size}
          anyReserved={anySelectedReserved}
          onClear={() => setSelected(new Set())}
          onReserve={() => setReserveModal({ mode: "create", rows: selectedRows })}
          onEditReservations={() => setReserveModal({ mode: "edit", rows: selectedRows })}
          onDelete={() => setDeleteModal(selectedRows)}
        />
      )}

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-gray-500">
          {trimmedQuery ? "No books found." : "No books in your library yet."}
        </p>
      )}

      {!loading && rows.length > 0 && viewMode === "list" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-800">
                <th className="w-8 py-2"></th>
                <th className="w-12 py-2"></th>
                {headers.map((h) => (
                  <th
                    key={h.key}
                    className={h.className}
                    aria-sort={sortKey === h.key ? (sortDir === 1 ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(h.key)}
                      className="inline-flex items-center gap-1 py-2 font-medium hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      {h.label}
                      {sortKey === h.key && <span className="text-[10px]">{sortDir === 1 ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                ))}
                <th className="w-20 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/dashboard/copies/${row.id}`)}
                  className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 dark:border-gray-900 dark:hover:bg-gray-900/50 ${
                    selected.has(row.id) ? "bg-gray-50 dark:bg-gray-900/50" : ""
                  }`}
                >
                  <td onClick={(e) => e.stopPropagation()} className="py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={(e) => toggleSelect(row.id, e.target.checked)}
                      aria-label={`Select ${row.book.title}`}
                    />
                  </td>
                  <td className="py-2">
                    <BookCover src={row.book.coverUrl} alt={row.book.title} className="h-14 w-10" />
                  </td>
                  <td className="max-w-[240px] truncate py-2 font-medium">{row.book.title}</td>
                  <td className="max-w-[180px] truncate py-2 text-gray-500">
                    {row.book.authors.join(", ") || "Unknown author"}
                  </td>
                  <td className="hidden truncate py-2 text-gray-500 sm:table-cell">{row.shelf?.name ?? "—"}</td>
                  <td className="hidden py-2 text-gray-500 md:table-cell">{formatDate(row.addedAt)}</td>
                  <td className="py-2">
                    <StatusPill status={row.status} />
                    {row.reservation && (
                      <span className="ml-1 block text-xs text-amber-700 dark:text-amber-400">
                        {row.reservation.reservedFor}
                      </span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openRowReserve(row)}
                        title={row.reservation ? "Edit reservation" : "Reserve"}
                        aria-label={`${row.reservation ? "Edit reservation for" : "Reserve"} ${row.book.title}`}
                        className={`rounded p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 ${row.reservation ? "text-amber-700 dark:text-amber-400" : "text-gray-500"}`}
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
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-red-700 dark:hover:bg-gray-800 dark:hover:text-red-400"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sortedRows.map((row) => (
            <div key={row.id} className="space-y-1.5">
              <div
                className="group relative cursor-pointer"
                onClick={() => router.push(`/dashboard/copies/${row.id}`)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ id: row.id, title: row.book.title, x: e.clientX, y: e.clientY, reserved: !!row.reservation });
                }}
              >
                <BookCover src={row.book.coverUrl} alt={row.book.title} className="aspect-[2/3] w-full" />
                {row.reservation && (
                  <span
                    className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-gray-950"
                    title={`Reserved — ${row.reservation.reservedFor}`}
                  />
                )}
                <label
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute left-1.5 top-1.5 rounded bg-white/90 p-0.5 shadow dark:bg-gray-950/90 ${
                    selected.has(row.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={(e) => toggleSelect(row.id, e.target.checked)}
                    aria-label={`Select ${row.book.title}`}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/copies/${row.id}`)}
                className="block w-full truncate text-left text-sm font-medium hover:underline"
              >
                {row.book.title}
              </button>
              <p className="truncate text-xs text-gray-500">{row.book.authors.join(", ") || "Unknown author"}</p>
              {row.reservation && (
                <p className="truncate text-xs text-amber-700 dark:text-amber-400">Reserved — {row.reservation.reservedFor}</p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="truncate">{row.shelf?.name ?? "No shelf"}</span>
                <span className="flex-shrink-0">{formatDate(row.addedAt)}</span>
              </div>
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
