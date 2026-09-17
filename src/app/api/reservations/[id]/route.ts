import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

const patchSchema = z.object({
  personId: z.string().trim().min(1).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  release: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/reservations/[id]">) {
  const { context, response } = await requireLibraryContext({ require: "edit" });
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

  if (release) {
    // Deletes the row (rather than only flagging it released) so the copy's unique
    // copyId slot is freed up and it can be reserved again later without a conflict.
    await prisma.$transaction([
      prisma.copy.update({ where: { id: reservation.copyId }, data: { status: "AVAILABLE" } }),
      prisma.reservation.delete({ where: { id } }),
    ]);
    return NextResponse.json({ released: true });
  }

  if (fields.personId) {
    const person = await prisma.person.findFirst({
      where: { id: fields.personId, libraryId: context.library.id },
    });
    if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: fields,
    include: { copy: { include: { book: true, shelf: true } }, person: true },
  });

  return NextResponse.json({ reservation: updated });
}
