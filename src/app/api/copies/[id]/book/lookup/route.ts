import { NextResponse } from "next/server";
import type { Book } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { applyBookOverride } from "@/lib/book-view";
import { lookupBookByIsbn, MAX_MANUAL_LOOKUP_ATTEMPTS } from "@/lib/books";

// Mirrors scan-in's own budget for a lookup that can chain several external calls.
export const maxDuration = 45;

/**
 * Manually (re-)resolves this copy's book against Google Books / Open Library.
 *
 * Three outcomes:
 *  - The book is already resolved (by this attempt, an automatic scan-in retry elsewhere,
 *    or someone else's copy of the same book) -- no external call is made, and this
 *    doesn't spend a manual attempt. Either way, whatever this library had saved as a
 *    BookOverride is deleted, since a resolved canonical title would otherwise be
 *    permanently hidden behind it (see CLAUDE.md decision: option 2 over option 1).
 *  - A real lookup finds the book -- same override deletion, plus the canonical Book row
 *    is updated directly (never left as an unsaved draft: there is no "save" step here).
 *  - A real lookup finds nothing -- the attempt is still spent so the button can't be
 *    clicked forever on a book that just isn't in either catalog.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/copies/[id]/book/lookup">) {
  const { context, response } = await requireLibraryContext({ require: "edit" });
  if (!context) return response;
  const { id } = await ctx.params;

  const libraryId = context.library.id;
  const copy = await prisma.copy.findFirst({ where: { id, libraryId }, include: { book: true } });
  if (!copy) return NextResponse.json({ error: "Copy not found" }, { status: 404 });

  async function clearOverrideAndRespond(book: Book, alreadyResolved: boolean) {
    await prisma.bookOverride.deleteMany({ where: { bookId: book.id, libraryId } });
    return NextResponse.json({ found: true, alreadyResolved, book: applyBookOverride(book, null) });
  }

  if (copy.book.source !== "manual-unresolved") {
    return clearOverrideAndRespond(copy.book, true);
  }

  if (copy.book.manualLookupAttempts >= MAX_MANUAL_LOOKUP_ATTEMPTS) {
    return NextResponse.json({ error: "No manual lookups left for this book" }, { status: 409 });
  }

  const looked = await lookupBookByIsbn(copy.book.isbn13);

  if (!looked) {
    const updated = await prisma.book.update({
      where: { id: copy.book.id },
      data: { manualLookupAttempts: { increment: 1 } },
    });
    return NextResponse.json({ found: false, manualLookupAttempts: updated.manualLookupAttempts });
  }

  const updated = await prisma.book.update({
    where: { id: copy.book.id },
    data: { ...looked, manualLookupAttempts: { increment: 1 } },
  });
  return clearOverrideAndRespond(updated, false);
}
