import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

/** Distinct names previously used in reservedFor, most-recently-used first, for autocomplete. */
export async function GET() {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;

  const reservations = await prisma.reservation.findMany({
    where: { copy: { libraryId: context.library.id } },
    distinct: ["reservedFor"],
    select: { reservedFor: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ people: reservations.map((r) => r.reservedFor) });
}
