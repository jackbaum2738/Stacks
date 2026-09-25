import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

const deleteSchema = z.object({ confirmName: z.string() });

/** Permanently deletes this library (and everything in it). Owner only, requires typing the exact name. */
export async function DELETE(request: Request, { params }: RouteContext<"/api/[libraryCode]">) {
  const { libraryCode } = await params;
  const { context, response } = await requireLibraryContext(libraryCode);
  if (!context) return response;
  if (context.membership.role !== "OWNER") {
    return NextResponse.json({ error: "Only an owner can delete this library" }, { status: 403 });
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmName !== context.library.name) {
    return NextResponse.json({ error: "Library name didn't match" }, { status: 400 });
  }

  await prisma.library.delete({ where: { id: context.library.id } });

  return NextResponse.json({ ok: true });
}
