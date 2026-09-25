"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { StatusPill } from "@/components/status-pill";
import { ReservationModal } from "@/components/reservation-modal";
import { MoveShelfModal } from "@/components/move-shelf-modal";
import type { PersonSummary } from "@/components/person-combobox";
import { DeleteCopiesModal } from "@/components/delete-copies-modal";
import { LibrarySelectionBar } from "@/components/library-selection-bar";
import { LibraryContextMenu, type ContextMenuTarget } from "@/components/library-context-menu";
import { NotePopup } from "@/components/note-popup";
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
    notes: string | null;
    shelf: { id: string; name: string } | null;
    reservation: { id: string; person: PersonSummary | null; note: string | null } | null;
  }[];
}

interface Row {
  id: string;
  status: "AVAILABLE" | "RESERVED" | "REMOVED";
  addedAt: string;
  notes: string | null;
  shelf: { id: string; name: string } | null;
  reservation: { id: string; person: PersonSummary | null } | null;
  book: { title: string; authors: string[]; coverUrl: string | null };
}

type SortKey = "title" | "author" | "shelf" | "added" | "status";

const VIEW_MODE_KEY = "stacks:library-view-mode";
const PAGE_SIZE_KEY = "stacks:library-page-size";
const PAGE_SIZES = [25, 50, 100, 200] as const;
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
      return collator.compare(a.reservation?.person?.name ?? "", b.reservation?.person?.name ?? "") * dir;
  }
}

export default function LibraryBrowsePage() {
  const router = useRouter();
  const { canEdit, code } = useLibraryRole();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reserveModal, setReserveModal] = useState<{ mode: "create" | "edit"; rows: Row[] } | null>(null);
  const [moveShelfModal, setMoveShelfModal] = useState<Row[] | null>(null);
  const [deleteModal, setDeleteModal] = useState<Row[] | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  const [notePopup, setNotePopup] = useState<{ copyId: string; bookTitle: string; note: string } | null>(null);

  const runSearch = useCallback(
    (q: string) => {
      return fetch(`/api/${code}/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => setBooks(data.books ?? []))
        .finally(() => setLoading(false));
    },
    [code]
  );

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
    try {
      const stored = Number(localStorage.getItem(PAGE_SIZE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (PAGE_SIZES.includes(stored as (typeof PAGE_SIZES)[number])) setPageSize(stored as (typeof PAGE_SIZES)[number]);
    } catch {
      // localStorage unavailable — fall back to default page size
    }
  }, []);

  function changePageSize(size: (typeof PAGE_SIZES)[number]) {
    setPageSize(size);
    setPage(1);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(size));
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
    setPage(1);
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
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedRows, currentPage, pageSize]
  );
  const pageNumbers = useMemo(() => {
    const want = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const nums = [...want].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    const withGaps: (number | "…")[] = [];
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) withGaps.push("…");
      withGaps.push(n);
    });
    return withGaps;
  }, [currentPage, totalPages]);

  function onFinished() {
    setSelected(new Set());
    setReserveModal(null);
    setMoveShelfModal(null);
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
    setPage(1);
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

  function openRowReserve(row: Row) {
    setReserveModal({ mode: row.reservation ? "edit" : "create", rows: [row] });
  }

  function openNote(row: Row, e: React.MouseEvent) {
    e.stopPropagation();
    if (!row.notes) return;
    setNotePopup({ copyId: row.id, bookTitle: row.book.title, note: row.notes });
  }

  async function saveNote(value: string) {
    if (!notePopup) return false;
    const res = await fetch(`/api/${code}/copies/${notePopup.copyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: value || null }),
    });
    if (!res.ok) return false;
    const copyId = notePopup.copyId;
    setBooks((prev) =>
      prev.map((b) => ({
        ...b,
        copies: b.copies.map((c) => (c.id === copyId ? { ...c, notes: value || null } : c)),
      }))
    );
    return true;
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
          onClear={() => setSelected(new Set())}
          onEditReservations={() => setReserveModal({ mode: "edit", rows: selectedRows })}
          onMoveShelf={() => setMoveShelfModal(selectedRows)}
          onDelete={() => setDeleteModal(selectedRows)}
        />
      )}

      {loading && <p className="font-sans text-sm text-ink-soft">Loading…</p>}

      {!loading && rows.length === 0 && (
        <p className="font-sans text-sm text-ink-soft">
          {trimmedQuery ? "No books found." : "No books in your library yet."}
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center border border-line-strong font-mono text-xs text-ink-soft">
            {PAGE_SIZES.map((size, i) => (
              <button
                key={size}
                type="button"
                aria-pressed={pageSize === size}
                onClick={() => changePageSize(size)}
                className={`px-3 py-[6px] ${i > 0 ? "border-l border-line-strong" : ""} ${
                  pageSize === size ? "bg-ink text-surface" : "hover:text-ink"
                }`}
              >
                {size}
              </button>
            ))}
            <span className="border-l border-line-strong px-3 py-[6px] uppercase tracking-[.08em]">per page</span>
          </div>
          <p className="font-mono text-xs text-ink-soft">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedRows.length)} of{" "}
            {sortedRows.length}
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && viewMode === "list" && (
        <div className="space-y-2 sm:hidden">
          {pagedRows.map((row) => (
            <div
              key={row.id}
              onClick={() => router.push(`/${code}/copies/${row.id}`)}
              className={`flex cursor-pointer items-center gap-3 border border-line bg-surface p-3 ${
                selected.has(row.id) ? "bg-row-hover" : ""
              }`}
            >
              {canEdit && (
                <div onClick={(e) => e.stopPropagation()} className="flex flex-shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={(e) => toggleSelect(row.id, e.target.checked)}
                    aria-label={`Select ${row.book.title}`}
                    className="accent-accent"
                  />
                </div>
              )}
              <div className="relative h-[60px] w-[42px] flex-shrink-0">
                <BookCover src={row.book.coverUrl} alt={row.book.title} className="h-[60px] w-[42px]" />
                {row.notes && (
                  <button
                    type="button"
                    onClick={(e) => openNote(row, e)}
                    title="Read note"
                    aria-label={`Read note for ${row.book.title}`}
                    className="absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 -rotate-[8deg] items-center justify-center rounded-[2px] border border-manila-line bg-manila text-manila-ink shadow-[0_2px_0_-1px_var(--manila-shadow)]"
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-2.5 w-2.5">
                      <path d="M4 4h9l3 3v9H4z" strokeLinejoin="round" />
                      <path d="M13 4v3h3" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[15px] font-medium text-ink">{row.book.title}</p>
                <p className="truncate font-sans text-xs text-ink-soft">
                  {row.book.authors.join(", ") || "Unknown author"}
                </p>
                <p className="mt-1 flex min-w-0 items-center gap-1 font-mono text-[11px] text-ink-faint">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoveShelfModal([row]);
                      }}
                      title="Move shelf"
                      className="max-w-[140px] truncate underline decoration-dotted hover:text-ink"
                    >
                      {row.shelf?.name ?? "No shelf"}
                    </button>
                  ) : (
                    <span className="max-w-[140px] truncate">{row.shelf?.name ?? "No shelf"}</span>
                  )}
                  <span className="flex-shrink-0">· {formatDate(row.addedAt)}</span>
                </p>
                {row.reservation && (
                  <p className="mt-1 truncate font-sans text-xs text-reserved-text">
                    Reserved — {row.reservation.person?.name ?? "someone no longer in your directory"}
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                <StatusPill status={row.status} />
                {canEdit && (
                  <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
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
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length > 0 && viewMode === "list" && (
        <div className="hidden overflow-x-auto border border-line bg-surface sm:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                {canEdit && <th className="w-[42px] py-2 pl-4"></th>}
                <th className={canEdit ? "w-11 py-2" : "w-[60px] py-2 pl-4"}></th>
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
              {pagedRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/${code}/copies/${row.id}`)}
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
                  <td className={canEdit ? "py-2.5" : "py-2.5 pl-4"}>
                    <div className="relative h-[50px] w-[34px]">
                      <BookCover src={row.book.coverUrl} alt={row.book.title} className="h-[50px] w-[34px]" />
                      {row.notes && (
                        <button
                          type="button"
                          onClick={(e) => openNote(row, e)}
                          title="Read note"
                          aria-label={`Read note for ${row.book.title}`}
                          className="absolute -top-1.5 -right-1.5 z-10 flex h-4 w-4 -rotate-[8deg] items-center justify-center rounded-[2px] border border-manila-line bg-manila text-manila-ink shadow-[0_2px_0_-1px_var(--manila-shadow)] transition-transform hover:rotate-0 hover:scale-[1.12]"
                        >
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[9px] w-[9px]">
                            <path d="M4 4h9l3 3v9H4z" strokeLinejoin="round" />
                            <path d="M13 4v3h3" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[240px] truncate py-2.5 font-display text-[16px] font-medium text-ink">
                    {row.book.title}
                  </td>
                  <td className="max-w-[170px] truncate py-2.5 font-sans text-ink-soft">
                    {row.book.authors.join(", ") || "Unknown author"}
                  </td>
                  <td className="hidden max-w-[160px] truncate py-2.5 font-mono text-[13px] text-ink sm:table-cell">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoveShelfModal([row]);
                        }}
                        title="Move shelf"
                        className="max-w-full truncate underline decoration-dotted hover:text-accent"
                      >
                        {row.shelf?.name ?? "No shelf"}
                      </button>
                    ) : (
                      row.shelf?.name ?? "—"
                    )}
                  </td>
                  <td className="hidden py-2.5 font-mono text-[12px] text-ink-soft md:table-cell">
                    {formatDate(row.addedAt)}
                  </td>
                  <td className="py-2.5">
                    <StatusPill status={row.status} />
                    {row.reservation && (
                      <span className="mt-1 block font-sans text-xs text-reserved-text">
                        {row.reservation.person?.name ?? "someone no longer in your directory"}
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
          {pagedRows.map((row) => (
            <div key={row.id} className="space-y-[7px]">
              <div
                className="group relative cursor-pointer"
                onClick={() => router.push(`/${code}/copies/${row.id}`)}
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
                {row.notes && (
                  <button
                    type="button"
                    onClick={(e) => openNote(row, e)}
                    title="Read note"
                    aria-label={`Read note for ${row.book.title}`}
                    className="absolute -top-1.5 -right-1.5 z-10 flex h-6 w-6 -rotate-[8deg] items-center justify-center rounded-[2px] border border-manila-line bg-manila text-manila-ink shadow-[0_3px_0_-1.5px_var(--manila-shadow)] transition-transform hover:rotate-0 hover:scale-[1.08]"
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3">
                      <path d="M4 4h9l3 3v9H4z" strokeLinejoin="round" />
                      <path d="M13 4v3h3" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => router.push(`/${code}/copies/${row.id}`)}
                className="block w-full truncate text-left font-display text-[15px] font-medium text-ink hover:underline"
              >
                {row.book.title}
              </button>
              <p className="truncate font-sans text-xs text-ink-soft">
                {row.book.authors.join(", ") || "Unknown author"}
              </p>
              <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-ink-faint">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMoveShelfModal([row]);
                    }}
                    title="Move shelf"
                    className="min-w-0 truncate text-left underline decoration-dotted hover:text-ink"
                  >
                    {row.shelf?.name ?? "No shelf"}
                  </button>
                ) : (
                  <span className="min-w-0 truncate">{row.shelf?.name ?? "No shelf"}</span>
                )}
                <span className="flex-shrink-0">{formatDate(row.addedAt)}</span>
              </div>
              {row.reservation && (
                <p className="truncate font-sans text-xs text-reserved-text">
                  Reserved — {row.reservation.person?.name ?? "someone no longer in your directory"}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="font-mono text-xs text-ink-soft">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
              className="flex h-[30px] min-w-[30px] items-center justify-center rounded-[2px] border border-line-strong bg-surface font-mono text-xs text-ink-muted hover:bg-chip-hover hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-surface disabled:hover:text-ink-muted"
            >
              ‹
            </button>
            {pageNumbers.map((n, i) =>
              n === "…" ? (
                <span key={`ellipsis-${i}`} className="flex h-[30px] w-[30px] items-center justify-center font-mono text-xs text-ink-faint">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  aria-current={n === currentPage}
                  onClick={() => setPage(n)}
                  className={`flex h-[30px] min-w-[30px] items-center justify-center rounded-[2px] border font-mono text-xs ${
                    n === currentPage
                      ? "border-ink bg-ink text-surface"
                      : "border-line-strong bg-surface text-ink-muted hover:bg-chip-hover hover:text-ink"
                  }`}
                >
                  {n}
                </button>
              )
            )}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next page"
              className="flex h-[30px] min-w-[30px] items-center justify-center rounded-[2px] border border-line-strong bg-surface font-mono text-xs text-ink-muted hover:bg-chip-hover hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-surface disabled:hover:text-ink-muted"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {notePopup && (
        <NotePopup
          bookTitle={notePopup.bookTitle}
          note={notePopup.note}
          canEdit={canEdit}
          onClose={() => setNotePopup(null)}
          onSave={saveNote}
        />
      )}

      {contextMenu && (
        <LibraryContextMenu
          target={contextMenu}
          onOpen={() => router.push(`/${code}/copies/${contextMenu.id}`)}
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
          code={code}
          onClose={() => setReserveModal(null)}
          onDone={onFinished}
        />
      )}
      {moveShelfModal && (
        <MoveShelfModal copies={moveShelfModal.map(toModalCopy)} code={code} onClose={() => setMoveShelfModal(null)} onDone={onFinished} />
      )}
      {deleteModal && (
        <DeleteCopiesModal copies={deleteModal.map(toModalCopy)} code={code} onClose={() => setDeleteModal(null)} onDone={onFinished} />
      )}
    </div>
  );
}
