import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { applyBookOverride } from "@/lib/book-view";

export async function GET(request: Request, { params }: RouteContext<"/api/[libraryCode]/reservations">) {
  const { libraryCode } = await params;
  const { context, response } = await requireLibraryContext(libraryCode);
  if (!context) return response;

  const { searchParams } = new URL(request.url);
  const includeReleased = searchParams.get("includeReleased") === "true";

  const reservations = await prisma.reservation.findMany({
    where: {
      copy: { libraryId: context.library.id },
      ...(includeReleased ? {} : { releasedAt: null }),
    },
    include: {
      copy: {
        include: { book: { include: { overrides: { where: { libraryId: context.library.id } } } }, shelf: true },
      },
      person: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    reservations: reservations.map((reservation) => ({
      ...reservation,
      copy: { ...reservation.copy, book: applyBookOverride(reservation.copy.book, reservation.copy.book.overrides[0]) },
    })),
  });
}

const createSchema = z.object({
  copyId: z.string().trim().min(1),
  personId: z.string().trim().min(1),
});

export async function POST(request: Request, { params }: RouteContext<"/api/[libraryCode]/reservations">) {
  const { libraryCode } = await params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "edit" });
  if (!context) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const copy = await prisma.copy.findFirst({
    where: { id: parsed.data.copyId, libraryId: context.library.id },
  });
  if (!copy) return NextResponse.json({ error: "Copy not found" }, { status: 404 });
  if (copy.status !== "AVAILABLE") {
    return NextResponse.json({ error: "This copy isn't available to reserve" }, { status: 409 });
  }

  const person = await prisma.person.findFirst({
    where: { id: parsed.data.personId, libraryId: context.library.id },
  });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const reservation = await prisma.$transaction(async (tx) => {
    await tx.copy.update({ where: { id: copy.id }, data: { status: "RESERVED" } });
    return tx.reservation.create({
      data: {
        copyId: copy.id,
        personId: person.id,
        createdById: context.user.id,
      },
      include: { copy: { include: { book: true, shelf: true } }, person: true },
    });
  });

  return NextResponse.json({ reservation }, { status: 201 });
}
