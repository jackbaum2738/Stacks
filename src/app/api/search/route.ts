import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { cleanIsbn } from "@/lib/isbn";

export async function GET(request: Request) {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const isbnCandidate = cleanIsbn(q);

  const books = await prisma.book.findMany({
    where: {
      copies: { some: { libraryId: context.library.id, status: { not: "REMOVED" } } },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { authors: { has: q } },
              ...(isbnCandidate.length >= 8 ? [{ isbn13: isbnCandidate }, { isbn10: isbnCandidate }] : []),
            ],
          }
        : {}),
    },
    include: {
      copies: {
        where: { libraryId: context.library.id, status: { not: "REMOVED" } },
        include: { shelf: true, reservation: true },
      },
    },
    orderBy: { title: "asc" },
    take: q ? 50 : 300,
  });

  return NextResponse.json({ books });
}
