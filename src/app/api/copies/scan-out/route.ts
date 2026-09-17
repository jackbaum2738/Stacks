import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { cleanIsbn, isValidIsbn, toIsbn13 } from "@/lib/isbn";
import { applyBookOverride } from "@/lib/book-view";

const schema = z.object({ isbn: z.string().trim().min(1) });

/**
 * Removes one physical copy of a book by ISBN. Prefers an AVAILABLE copy;
 * falls back to the oldest RESERVED copy (treating this as the reservation
 * being fulfilled/sent), since a scan can't distinguish which physical copy
 * is in hand when several exist.
 */
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

  const book = await prisma.book.findUnique({ where: { isbn13 } });
  if (!book) {
    return NextResponse.json({ error: "No book with this ISBN is in your library" }, { status: 404 });
  }

  const target =
    (await prisma.copy.findFirst({
      where: { libraryId: context.library.id, bookId: book.id, status: "AVAILABLE" },
      orderBy: { addedAt: "asc" },
    })) ??
    (await prisma.copy.findFirst({
      where: { libraryId: context.library.id, bookId: book.id, status: "RESERVED" },
      orderBy: { addedAt: "asc" },
      include: { reservation: true },
    }));

  if (!target) {
    return NextResponse.json({ error: "No copies of this book are currently in your library" }, { status: 404 });
  }

  const hadReservation = "reservation" in target && target.reservation !== null;

  const updated = await prisma.$transaction(async (tx) => {
    if (hadReservation) {
      await tx.reservation.update({ where: { copyId: target.id }, data: { releasedAt: new Date() } });
    }
    return tx.copy.update({
      where: { id: target.id },
      data: { status: "REMOVED", removedAt: new Date() },
      include: {
        book: { include: { overrides: { where: { libraryId: context.library.id } } } },
        shelf: true,
        reservation: true,
      },
    });
  });
  const updatedCopy = { ...updated, book: applyBookOverride(updated.book, updated.book.overrides[0]) };

  return NextResponse.json({ copy: updatedCopy });
}
