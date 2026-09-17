import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

const patchSchema = z.object({
  shelfId: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/copies/[id]">) {
  const { context, response } = await requireLibraryContext({ require: "edit" });
  if (!context) return response;
  const { id } = await ctx.params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const copy = await prisma.copy.findFirst({ where: { id, libraryId: context.library.id } });
  if (!copy) return NextResponse.json({ error: "Copy not found" }, { status: 404 });

  if (parsed.data.shelfId) {
    const shelf = await prisma.shelf.findFirst({
      where: { id: parsed.data.shelfId, libraryId: context.library.id },
    });
    if (!shelf) return NextResponse.json({ error: "Shelf not found" }, { status: 404 });
  }

  const updated = await prisma.copy.update({
    where: { id },
    data: parsed.data,
    include: { book: true, shelf: true, reservation: { include: { person: true } } },
  });

  return NextResponse.json({ copy: updated });
}

/** Soft-removes a copy from the library (keeps history) and releases any active reservation. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/copies/[id]">) {
  const { context, response } = await requireLibraryContext({ require: "edit" });
  if (!context) return response;
  const { id } = await ctx.params;

  const copy = await prisma.copy.findFirst({
    where: { id, libraryId: context.library.id },
    include: { reservation: true },
  });
  if (!copy) return NextResponse.json({ error: "Copy not found" }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    if (copy.reservation && !copy.reservation.releasedAt) {
      await tx.reservation.update({ where: { copyId: id }, data: { releasedAt: new Date() } });
    }
    return tx.copy.update({
      where: { id },
      data: { status: "REMOVED", removedAt: new Date() },
      include: { book: true, shelf: true, reservation: { include: { person: true } } },
    });
  });

  return NextResponse.json({ copy: updated });
}
