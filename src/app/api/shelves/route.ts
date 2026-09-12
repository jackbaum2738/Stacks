import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

export async function GET() {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;

  const shelves = await prisma.shelf.findMany({
    where: { libraryId: context.library.id },
    include: { _count: { select: { copies: { where: { status: { not: "REMOVED" } } } } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ shelves });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(100).optional(),
});

export async function POST(request: Request) {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.shelf.findUnique({
    where: { libraryId_name: { libraryId: context.library.id, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ error: "A shelf with that name already exists" }, { status: 409 });
  }

  const shelf = await prisma.shelf.create({
    data: { libraryId: context.library.id, name: parsed.data.name, code: parsed.data.code },
  });

  return NextResponse.json({ shelf }, { status: 201 });
}
