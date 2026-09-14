import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(500),
  authors: z.array(z.string().trim().min(1)).max(20),
  publisher: z.string().trim().max(200).nullable(),
  pageCount: z.number().int().positive().nullable(),
  description: z.string().trim().max(5000).nullable(),
  coverUrl: z.string().trim().url().nullable(),
  bookCrossingId: z.string().trim().max(100).nullable(),
});

/**
 * Edits a Book's shared catalog metadata. Book rows are reused across every library and
 * every future scan-in of the same ISBN (see prisma/schema.prisma) — so unlike a Copy or
 * Reservation, an edit here isn't scoped to "this copy" or "this library", it corrects the
 * shared record for that ISBN going forward, everywhere. Any signed-in library member can
 * make this edit (not just owners/admins) as long as their library actually holds a copy
 * of the book, matching the low-stakes, crowd-correctable nature of catalog metadata.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/books/[id]">) {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;
  const { id } = await ctx.params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const book = await prisma.book.findFirst({
    where: { id, copies: { some: { libraryId: context.library.id, status: { not: "REMOVED" } } } },
  });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const updated = await prisma.book.update({ where: { id }, data: parsed.data });

  return NextResponse.json({ book: updated });
}
