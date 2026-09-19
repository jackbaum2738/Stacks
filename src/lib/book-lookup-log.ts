import { prisma } from "@/lib/prisma";
import type { LookupDiagnostics } from "@/lib/books";

export type LookupTrigger = "scan-in" | "scan-in-retry" | "manual-button";

/** Persists one BookLookupLog row -- see the model's schema.prisma comment for why this exists. */
export async function logBookLookupAttempt(params: {
  libraryId: string;
  isbn13: string;
  triggeredBy: LookupTrigger;
  diagnostics: LookupDiagnostics;
  resolved: boolean;
}) {
  await prisma.bookLookupLog.create({
    data: {
      libraryId: params.libraryId,
      isbn13: params.isbn13,
      triggeredBy: params.triggeredBy,
      googleBooksCalled: params.diagnostics.googleBooks.called,
      // Google Books is always the first call this module makes, so its outcome is never
      // null when it was called -- the fallback here is just to satisfy the DB's NOT NULL
      // column if that assumption is ever broken.
      googleBooksOutcome: params.diagnostics.googleBooks.outcome ?? "network-error",
      googleBooksDetail: params.diagnostics.googleBooks.detail,
      openLibraryCalled: params.diagnostics.openLibrary.called,
      openLibraryOutcome: params.diagnostics.openLibrary.outcome,
      openLibraryDetail: params.diagnostics.openLibrary.detail,
      resolved: params.resolved,
    },
  });
}
