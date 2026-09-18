import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { cleanIsbn, isValidIsbn, toIsbn13 } from "@/lib/isbn";
import { applyBookOverride } from "@/lib/book-view";

const schema = z.object({
  isbn: z.string().trim().min(1),
  // Set once a scan matched more than one copy of the same ISBN and the picker
  // above resolved which physical copy to remove.
  copyId: z.string().trim().min(1).optional(),
});

async function finalizeRemoval(libraryId: string, targetId: string) {
  const target = await prisma.copy.findFirst({
    where: { id: targetId, libraryId, status: { not: "REMOVED" } },
    include: { reservation: true },
  });
  if (!target) return null;

  const hadReservation = target.reservation !== null;

  return prisma.$transaction(async (tx) => {
    if (hadReservation) {
      await tx.reservation.update({ where: { copyId: target.id }, data: { releasedAt: new Date() } });
    }
    return tx.copy.update({
      where: { id: target.id },
      data: { status: "REMOVED", removedAt: new Date() },
      include: {
        book: { include: { overrides: { where: { libraryId } } } },
        shelf: true,
        reservation: { include: { person: true } },
      },
    });
  });
}

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

  const book = await prisma.book.findUnique({
    where: { isbn13 },
    include: { overrides: { where: { libraryId: context.library.id } } },
  });
  if (!book) {
    return NextResponse.json({ error: "No book with this ISBN is in your library" }, { status: 404 });
  }
  const viewBook = applyBookOverride(book, book.overrides[0]);

  // A copyId means the picker below already resolved which physical copy to
  // remove -- finalize that one directly rather than re-picking.
  if (parsed.data.copyId) {
    const updated = await finalizeRemoval(context.library.id, parsed.data.copyId);
    if (!updated) {
      return NextResponse.json(
        { error: "That copy is no longer in your library — it may have just been removed elsewhere." },
        { status: 404 },
      );
    }
    const updatedCopy = { ...updated, book: applyBookOverride(updated.book, updated.book.overrides[0]) };
    return NextResponse.json({ copy: updatedCopy });
  }

  const candidates = await prisma.copy.findMany({
    where: { libraryId: context.library.id, bookId: book.id, status: { not: "REMOVED" } },
    orderBy: { addedAt: "asc" },
    include: { shelf: true, reservation: { include: { person: true } } },
  });

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No copies of this book are currently in your library" }, { status: 404 });
  }

  // Only one copy in hand -- nothing to pick, remove it directly like before.
  if (candidates.length === 1) {
    const updated = await finalizeRemoval(context.library.id, candidates[0].id);
    if (!updated) {
      return NextResponse.json({ error: "No copies of this book are currently in your library" }, { status: 404 });
    }
    const updatedCopy = { ...updated, book: applyBookOverride(updated.book, updated.book.overrides[0]) };
    return NextResponse.json({ copy: updatedCopy });
  }

  // Several copies share this ISBN -- a bare barcode scan can't tell which physical
  // copy is in hand, so hand the choice back to the scan station instead of guessing.
  return NextResponse.json({
    book: { title: viewBook.title, authors: viewBook.authors, coverUrl: viewBook.coverUrl },
    choices: candidates.map((c) => ({
      id: c.id,
      shelfName: c.shelf?.name ?? null,
      status: c.status,
      addedAt: c.addedAt,
      reservedForName: c.reservation?.person?.name ?? null,
    })),
  });
}
