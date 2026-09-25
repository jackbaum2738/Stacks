import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { applyBookOverride } from "@/lib/book-view";

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
 * Edits how this copy's book displays *within this library only*. Title/authors/publisher/
 * pageCount/description/coverUrl are stored as a per-(book, library) BookOverride — see the
 * schema comment — so a correction here is invisible to every other library sharing this
 * ISBN's canonical Book row; one library's bad edit can't corrupt what anyone else sees.
 * bookCrossingId is written straight onto this Copy: it identifies one physical released
 * copy, not the title/edition, so it was never shared to begin with.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/[libraryCode]/copies/[id]/book">) {
  const { libraryCode, id } = await ctx.params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "edit" });
  if (!context) return response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const copy = await prisma.copy.findFirst({ where: { id, libraryId: context.library.id } });
  if (!copy) return NextResponse.json({ error: "Copy not found" }, { status: 404 });

  const { bookCrossingId, ...overrideFields } = parsed.data;

  const [book, updatedCopy] = await prisma.$transaction([
    prisma.bookOverride.upsert({
      where: { bookId_libraryId: { bookId: copy.bookId, libraryId: context.library.id } },
      create: { bookId: copy.bookId, libraryId: context.library.id, ...overrideFields },
      update: overrideFields,
    }),
    prisma.copy.update({ where: { id }, data: { bookCrossingId } }),
  ]);

  const canonical = await prisma.book.findUniqueOrThrow({ where: { id: copy.bookId } });

  return NextResponse.json({
    book: applyBookOverride(canonical, book),
    bookCrossingId: updatedCopy.bookCrossingId,
  });
}
