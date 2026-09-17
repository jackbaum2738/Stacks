"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { StatusPill } from "@/components/status-pill";
import { CopyButton } from "@/components/copy-button";
import { CopyNotecard } from "@/components/copy-notecard";
import { ReservationModal } from "@/components/reservation-modal";
import { DeleteCopiesModal } from "@/components/delete-copies-modal";
import { formatDate } from "@/lib/format-date";

interface CopyDetailData {
  id: string;
  status: "AVAILABLE" | "RESERVED" | "REMOVED";
  addedAt: Date;
  bookCrossingId: string | null;
  notes: string | null;
  shelf: { id: string; name: string; code: string | null } | null;
  book: {
    isbn13: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    publisher: string | null;
    pageCount: number | null;
    description: string | null;
  };
  reservation: { id: string; reservedFor: string; contact: string | null; createdAt: Date } | null;
}

export function CopyDetail({ copy, libraryName }: { copy: CopyDetailData; libraryName: string }) {
  const router = useRouter();
  const [reserveModal, setReserveModal] = useState<"create" | "edit" | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);

  const modalCopy = { id: copy.id, book: { title: copy.book.title }, reservation: copy.reservation };
  const shelfLabel = copy.shelf?.code ?? copy.shelf?.name ?? "—";

  return (
    <div className="paper-shadow-lg grid gap-[56px] border border-line bg-surface p-8 sm:grid-cols-[200px_1fr]">
      <div>
        <BookCover src={copy.book.coverUrl} alt={copy.book.title} className="aspect-[2/3] w-full max-w-[200px]" />
        <div className="mt-[11px] space-y-1.5 font-mono text-[11px] tracking-[.08em] text-ink-soft uppercase">
          <p>Shelf {shelfLabel}</p>
          <p className="flex items-center">
            ISBN {copy.book.isbn13}
            <CopyButton value={copy.book.isbn13} label="ISBN" />
          </p>
          {copy.bookCrossingId && (
            <p className="flex items-center">
              BookCrossing ID {copy.bookCrossingId}
              <CopyButton value={copy.bookCrossingId} label="BookCrossing ID" />
            </p>
          )}
        </div>

        <CopyNotecard copyId={copy.id} initialNote={copy.notes} />
      </div>

      <div className="min-w-0">
        <div className="mb-[18px] flex items-center justify-between border-b border-line pb-[10px] font-mono text-[11px] tracking-[.14em] text-ink-soft uppercase">
          <span>{libraryName}</span>
          <span>Shelf {shelfLabel}</span>
        </div>

        <h1 className="font-display text-[40px] leading-[1.08] font-semibold text-balance text-ink">
          {copy.book.title}
        </h1>
        <p className="mt-1 font-sans text-[17px] text-ink-soft">
          {copy.book.authors.join(", ") || "Unknown author"}
        </p>

        <div className="mt-4 mb-5 flex flex-wrap items-center gap-2">
          {copy.status === "RESERVED" ? (
            <span className="inline-flex rounded-[2px] bg-accent px-[10px] py-[5px] font-mono text-[11px] font-medium tracking-[.12em] text-on-accent uppercase">
              Reserved
            </span>
          ) : (
            <StatusPill status={copy.status} />
          )}
          {copy.reservation && (
            <span className="font-sans text-sm text-ink-muted">
              for {copy.reservation.reservedFor}
              {copy.reservation.contact ? ` · ${copy.reservation.contact}` : ""}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-b border-line py-[14px] text-sm">
          <dt className="font-mono text-[11px] tracking-[.10em] text-ink-faint uppercase">Shelf</dt>
          <dd className="font-sans text-ink">{copy.shelf?.name ?? "No shelf"}</dd>
          <dt className="font-mono text-[11px] tracking-[.10em] text-ink-faint uppercase">Date added</dt>
          <dd className="font-sans text-ink">{formatDate(copy.addedAt)}</dd>
          {copy.reservation && (
            <>
              <dt className="font-mono text-[11px] tracking-[.10em] text-ink-faint uppercase">Date reserved</dt>
              <dd className="font-sans text-ink">{formatDate(copy.reservation.createdAt)}</dd>
            </>
          )}
          {copy.book.publisher && (
            <>
              <dt className="font-mono text-[11px] tracking-[.10em] text-ink-faint uppercase">Publisher</dt>
              <dd className="font-sans text-ink">{copy.book.publisher}</dd>
            </>
          )}
          {copy.book.pageCount && (
            <>
              <dt className="font-mono text-[11px] tracking-[.10em] text-ink-faint uppercase">Pages</dt>
              <dd className="font-sans text-ink">{copy.book.pageCount}</dd>
            </>
          )}
        </dl>

        {copy.book.description && (
          <p className="mt-5 max-w-[62ch] font-sans text-[15px] leading-[1.7] text-ink-muted">
            {copy.book.description}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReserveModal(copy.reservation ? "edit" : "create")}
            className="inline-flex items-center gap-1.5 rounded-[2px] bg-ink px-[18px] py-[11px] font-sans text-sm font-medium text-surface hover:brightness-95"
          >
            <svg viewBox="0 0 24 24" fill={copy.reservation ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-[15px] w-[15px]">
              <path d="M7 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16l-5-3.2L7 20V4z" />
            </svg>
            {copy.reservation ? "Edit reservation" : "Reserve"}
          </button>
          <button
            type="button"
            onClick={() => setDeleteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-[2px] border border-line-strong px-[18px] py-[11px] font-sans text-sm font-medium text-accent hover:bg-chip-hover"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Remove from library
          </button>
          <Link
            href={`/dashboard/copies/${copy.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-[2px] border border-line-strong px-[18px] py-[11px] font-sans text-sm font-medium text-ink hover:bg-chip-hover"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Edit details
          </Link>
        </div>
      </div>

      {reserveModal && (
        <ReservationModal
          mode={reserveModal}
          copies={[modalCopy]}
          onClose={() => setReserveModal(null)}
          onDone={() => setReserveModal(null)}
        />
      )}
      {deleteModal && (
        <DeleteCopiesModal
          copies={[modalCopy]}
          onClose={() => setDeleteModal(false)}
          onDone={() => router.push("/dashboard/search")}
        />
      )}
    </div>
  );
}
