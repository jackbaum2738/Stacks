import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

export async function GET() {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;

  const memberships = await prisma.membership.findMany({
    where: { libraryId: context.library.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ members: memberships });
}
