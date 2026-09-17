import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { lookupBookByIsbn } from "@/lib/books";
import { cleanIsbn, isValidIsbn, toIsbn13 } from "@/lib/isbn";
import { applyBookOverride } from "@/lib/book-view";
import { generateUniqueCopyCode } from "@/lib/copy-code";

// Book lookup can chain up to four sequential external API calls (up to 10s
// each); give it more headroom than the platform default function timeout.
export const maxDuration = 45;

const schema = z.object({
  isbn: z.string().trim().min(1),
  shelfId: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const { context, response } = await requireLibraryContext({ require: "edit" });
  if (!context) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const isbn = cleanIsbn(parsed.data.isbn);
  if (!isValidIsbn(isbn)) {
    return NextResponse.json({ error: `"${parsed.data.isbn}" isn't a valid 10 or 13 digit ISBN` }, { status: 400 });
  }
  const isbn13 = toIsbn13(isbn);

  const shelf = await prisma.shelf.findFirst({
    where: { id: parsed.data.shelfId, libraryId: context.library.id },
  });
  if (!shelf) return NextResponse.json({ error: "Shelf not found" }, { status: 404 });

  let book = await prisma.book.findUnique({ where: { isbn13 } });
  let lookupFailed = false;

  if (!book) {
    const looked = await lookupBookByIsbn(isbn13);
    if (looked) {
      book = await prisma.book.create({ data: looked });
    } else {
      lookupFailed = true;
      book = await prisma.book.create({
        data: {
          isbn13,
          isbn10: isbn.length === 10 ? isbn : null,
          title: `Unknown title (ISBN ${isbn13})`,
          authors: [],
          source: "manual-unresolved",
        },
      });
    }
  } else if (book.source === "manual-unresolved") {
    // A previous scan couldn't resolve this ISBN (e.g. a transient API
    // failure) — retry now instead of permanently reusing the placeholder.
    const looked = await lookupBookByIsbn(isbn13);
    if (looked) {
      book = await prisma.book.update({ where: { id: book.id }, data: looked });
    } else {
      lookupFailed = true;
    }
  }

  const existingAvailable = await prisma.copy.count({
    where: { libraryId: context.library.id, bookId: book.id, status: { not: "REMOVED" } },
  });

  const code = await generateUniqueCopyCode(prisma, context.library.id);
  const created = await prisma.copy.create({
    data: { libraryId: context.library.id, bookId: book.id, shelfId: shelf.id, status: "AVAILABLE", code },
    include: {
      book: { include: { overrides: { where: { libraryId: context.library.id } } } },
      shelf: true,
    },
  });
  const copy = { ...created, book: applyBookOverride(created.book, created.book.overrides[0]) };

  return NextResponse.json(
    { copy, lookupFailed, otherCopiesOfThisBook: existingAvailable },
    { status: 201 }
  );
}
