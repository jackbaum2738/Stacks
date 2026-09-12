import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

const patchSchema = z.object({
  reservedFor: z.string().trim().min(1).max(200).optional(),
  contact: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  release: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/reservations/[id]">) {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;
  const { id } = await ctx.params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const reservation = await prisma.reservation.findFirst({
    where: { id, copy: { libraryId: context.library.id } },
  });
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });

  const { release, ...fields } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    if (release && !reservation.releasedAt) {
      await tx.copy.update({ where: { id: reservation.copyId }, data: { status: "AVAILABLE" } });
    }
    return tx.reservation.update({
      where: { id },
      data: { ...fields, ...(release ? { releasedAt: new Date() } : {}) },
      include: { copy: { include: { book: true, shelf: true } } },
    });
  });

  return NextResponse.json({ reservation: updated });
}
