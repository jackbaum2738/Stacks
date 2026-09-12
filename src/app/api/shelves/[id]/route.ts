import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().max(100).nullable().optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/shelves/[id]">) {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;
  const { id } = await ctx.params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const shelf = await prisma.shelf.findFirst({ where: { id, libraryId: context.library.id } });
  if (!shelf) return NextResponse.json({ error: "Shelf not found" }, { status: 404 });

  const updated = await prisma.shelf.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ shelf: updated });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/shelves/[id]">) {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;
  const { id } = await ctx.params;

  const shelf = await prisma.shelf.findFirst({
    where: { id, libraryId: context.library.id },
    include: { _count: { select: { copies: { where: { status: { not: "REMOVED" } } } } } },
  });
  if (!shelf) return NextResponse.json({ error: "Shelf not found" }, { status: 404 });
  if (shelf._count.copies > 0) {
    return NextResponse.json({ error: "Move or remove the books on this shelf first" }, { status: 409 });
  }

  await prisma.shelf.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
