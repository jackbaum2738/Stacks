"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { StatusPill } from "@/components/status-pill";
import { ReservationModal } from "@/components/reservation-modal";
import { DeleteCopiesModal } from "@/components/delete-copies-modal";
import { formatDate } from "@/lib/format-date";

interface CopyDetailData {
  id: string;
  status: "AVAILABLE" | "RESERVED" | "REMOVED";
  addedAt: Date;
  shelf: { id: string; name: string } | null;
  book: {
    title: string;
    authors: string[];
    coverUrl: string | null;
    publisher: string | null;
    pageCount: number | null;
    description: string | null;
  };
  reservation: { id: string; reservedFor: string; contact: string | null; createdAt: Date } | null;
}

export function CopyDetail({ copy }: { copy: CopyDetailData }) {
  const router = useRouter();
  const [reserveModal, setReserveModal] = useState<"create" | "edit" | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);

  const modalCopy = { id: copy.id, book: { title: copy.book.title }, reservation: copy.reservation };

  return (
    <div className="grid gap-8 sm:grid-cols-[200px_1fr]">
      <BookCover src={copy.book.coverUrl} alt={copy.book.title} className="w-full max-w-[200px] aspect-[2/3]" />

      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-balance">{copy.book.title}</h1>
        <p className="mb-4 text-gray-500">{copy.book.authors.join(", ") || "Unknown author"}</p>

        <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-gray-400">Shelf</dt>
          <dd>{copy.shelf?.name ?? "No shelf"}</dd>
          <dt className="text-gray-400">Date added</dt>
          <dd>{formatDate(copy.addedAt)}</dd>
          {copy.reservation && (
            <>
              <dt className="text-gray-400">Date reserved</dt>
              <dd>{formatDate(copy.reservation.createdAt)}</dd>
            </>
          )}
          {copy.book.publisher && (
            <>
              <dt className="text-gray-400">Publisher</dt>
              <dd>{copy.book.publisher}</dd>
            </>
          )}
          {copy.book.pageCount && (
            <>
              <dt className="text-gray-400">Pages</dt>
              <dd>{copy.book.pageCount}</dd>
            </>
          )}
        </dl>

        <div className="mb-5">
          <StatusPill status={copy.status} />
          {copy.reservation && (
            <span className="ml-2 text-sm text-amber-700 dark:text-amber-400">
              for {copy.reservation.reservedFor}
              {copy.reservation.contact ? ` (${copy.reservation.contact})` : ""}
            </span>
          )}
        </div>

        {copy.book.description && (
          <p className="mb-6 max-w-[62ch] text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {copy.book.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReserveModal(copy.reservation ? "edit" : "create")}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700"
          >
            <svg viewBox="0 0 24 24" fill={copy.reservation ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-4 w-4">
              <path d="M7 4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16l-5-3.2L7 20V4z" />
            </svg>
            {copy.reservation ? "Edit reservation" : "Reserve"}
          </button>
          <button
            type="button"
            onClick={() => setDeleteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-red-700 dark:border-gray-700 dark:text-red-400"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Remove from library
          </button>
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
