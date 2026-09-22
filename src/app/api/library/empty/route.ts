import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

const emptySchema = z.object({ confirmName: z.string() });

/**
 * Clears every Copy and Reservation in the library (Copy's Reservation cascades
 * automatically), plus that library's BookOverride corrections -- since they'd otherwise be
 * orphaned corrections for books no copy of which exists anymore. Unlike the original "wipe"
 * version of this action, Shelf rows are left alone -- Jack's dad's shelf structure (~30
 * physical shelves with their own codes) is real setup work, and emptying the collection
 * shouldn't force redoing it. Leaves the Library row, memberships/roles, and invite links
 * alone too. Admin+ (see canManageLibrarySettings), unlike full deletion which is Owner-only
 * -- requires typing the exact library name.
 */
export async function POST(request: Request) {
  const { context, response } = await requireLibraryContext({ require: "manage" });
  if (!context) return response;

  const parsed = emptySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmName !== context.library.name) {
    return NextResponse.json({ error: "Library name didn't match" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.copy.deleteMany({ where: { libraryId: context.library.id } }),
    prisma.bookOverride.deleteMany({ where: { libraryId: context.library.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
