import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { cleanIsbn } from "@/lib/isbn";
import { applyBookOverride } from "@/lib/book-view";

export async function GET(request: Request) {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const query = q.toLowerCase();
  const isbnCandidate = cleanIsbn(q);

  const books = await prisma.book.findMany({
    where: { copies: { some: { libraryId: context.library.id, status: { not: "REMOVED" } } } },
    include: {
      overrides: { where: { libraryId: context.library.id } },
      copies: {
        where: { libraryId: context.library.id, status: { not: "REMOVED" } },
        include: { shelf: true, reservation: true },
      },
    },
  });

  // Title/authors can be library-corrected (BookOverride), so matching and sorting happen
  // after merging rather than as a SQL WHERE against the raw Book columns.
  const merged = books.map(({ overrides, ...book }) => applyBookOverride(book, overrides[0]));

  const filtered = q
    ? merged.filter(
        (book) =>
          book.title.toLowerCase().includes(query) ||
          book.authors.includes(q) ||
          book.copies.some((c) => c.bookCrossingId?.toLowerCase().includes(query)) ||
          (isbnCandidate.length >= 8 && (book.isbn13 === isbnCandidate || book.isbn10 === isbnCandidate))
      )
    : merged;

  const sorted = filtered.sort((a, b) => a.title.localeCompare(b.title));

  return NextResponse.json({ books: sorted.slice(0, q ? 50 : 300) });
}
