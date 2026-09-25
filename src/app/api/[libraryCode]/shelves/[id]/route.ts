import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().max(100).nullable().optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/[libraryCode]/shelves/[id]">) {
  const { libraryCode, id } = await ctx.params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "manage" });
  if (!context) return response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const shelf = await prisma.shelf.findFirst({ where: { id, libraryId: context.library.id } });
  if (!shelf) return NextResponse.json({ error: "Shelf not found" }, { status: 404 });

  if (parsed.data.name !== undefined) {
    const nameClash = await prisma.shelf.findFirst({
      where: { libraryId: context.library.id, name: parsed.data.name, id: { not: id } },
    });
    if (nameClash) {
      return NextResponse.json({ error: "A shelf with that name already exists" }, { status: 409 });
    }
  }

  const code = parsed.data.code !== undefined ? parsed.data.code?.trim() || null : undefined;
  if (code) {
    const codeClash = await prisma.shelf.findFirst({
      where: { libraryId: context.library.id, code, id: { not: id } },
    });
    if (codeClash) {
      return NextResponse.json({ error: `Code "${code}" is already used by "${codeClash.name}"` }, { status: 409 });
    }
  }

  const updated = await prisma.shelf.update({ where: { id }, data: { ...parsed.data, ...(code !== undefined ? { code } : {}) } });
  return NextResponse.json({ shelf: updated });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/[libraryCode]/shelves/[id]">) {
  const { libraryCode, id } = await ctx.params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "manage" });
  if (!context) return response;

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
