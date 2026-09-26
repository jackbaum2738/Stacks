import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().max(200).email().optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  birthday: z.string().trim().optional().or(z.literal("")), // yyyy-mm-dd, "" clears it
});

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/[libraryCode]/people/[id]">) {
  const { libraryCode, id } = await ctx.params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "edit" });
  if (!context) return response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Invalid input", field: issue?.path[0] }, { status: 400 });
  }

  const person = await prisma.person.findFirst({ where: { id, libraryId: context.library.id } });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const { name, phone, location, birthday } = parsed.data;
  const email = parsed.data.email !== undefined ? (parsed.data.email ? parsed.data.email.toLowerCase() : null) : undefined;

  if (name !== undefined) {
    const clash = await prisma.person.findFirst({
      where: { libraryId: context.library.id, name, id: { not: id } },
    });
    if (clash) {
      return NextResponse.json(
        { error: `A person named "${clash.name}" already exists`, field: "name", conflictingPersonId: clash.id },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.person.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(location !== undefined ? { location: location || null } : {}),
      ...(birthday !== undefined ? { birthday: birthday ? new Date(birthday) : null } : {}),
    },
    include: { _count: { select: { reservations: { where: { releasedAt: null } } } } },
  });

  const { _count, ...rest } = updated;
  return NextResponse.json({ person: { ...rest, activeReservationCount: _count.reservations } });
}

/**
 * Removes a person from the directory. Unlike a copy, this is always allowed even if
 * they're currently holding books -- Jack's call, since a person isn't a user account.
 * Any book they're currently holding is released back to Available first; a released
 * reservation still referencing them (a book already sent out) just has its personId
 * cleared by the FK's ON DELETE SET NULL, keeping that history intact.
 */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/[libraryCode]/people/[id]">) {
  const { libraryCode, id } = await ctx.params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "edit" });
  if (!context) return response;

  const person = await prisma.person.findFirst({ where: { id, libraryId: context.library.id } });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const activeReservations = await prisma.reservation.findMany({
    where: { personId: id, releasedAt: null },
    select: { copyId: true },
  });

  await prisma.$transaction([
    ...activeReservations.map((r) => prisma.copy.update({ where: { id: r.copyId }, data: { status: "AVAILABLE" } })),
    prisma.reservation.deleteMany({ where: { personId: id, releasedAt: null } }),
    prisma.person.delete({ where: { id } }),
  ]);

  return NextResponse.json({ deleted: true, releasedCount: activeReservations.length });
}
