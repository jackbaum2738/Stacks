import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { applyBookOverride } from "@/lib/book-view";
import { EXPORT_COLUMNS, toCsv } from "@/lib/csv";

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  REMOVED: "Removed",
};

/**
 * A full backup of everything currently in the library, in the same column shape as the
 * import template (see EXPORT_COLUMNS) so export -> edit in a spreadsheet -> re-import
 * round-trips cleanly. Records who took the backup and when, shown on the Settings page.
 */
export async function GET() {
  const { context, response } = await requireLibraryContext({ require: "edit" });
  if (!context) return response;

  const copies = await prisma.copy.findMany({
    where: { libraryId: context.library.id, status: { not: "REMOVED" } },
    include: {
      book: { include: { overrides: { where: { libraryId: context.library.id } } } },
      shelf: true,
      reservation: true,
    },
    orderBy: { addedAt: "asc" },
  });

  const rows = copies.map((copy) => {
    const book = applyBookOverride(copy.book, copy.book.overrides[0]);
    return [
      copy.id,
      copy.book.isbn13,
      book.title,
      book.authors.join("; "),
      book.publisher,
      copy.shelf?.name ?? "",
      STATUS_LABEL[copy.status] ?? copy.status,
      copy.reservation?.reservedFor ?? "",
      copy.reservation?.contact ?? "",
      copy.notes,
      copy.bookCrossingId,
      copy.addedAt.toISOString().slice(0, 10),
    ];
  });

  const takenAt = new Date();
  await prisma.library.update({
    where: { id: context.library.id },
    data: { lastBackupAt: takenAt, lastBackupByUserId: context.user.id },
  });

  const csv = toCsv([[...EXPORT_COLUMNS], ...rows]);
  const filename = `${context.library.slug}-backup-${takenAt.toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Read by the Settings page's download handler so it can show the updated
      // "last backup" line immediately, without waiting on a router.refresh()
      // whose timing it can't otherwise be sure has landed.
      "X-Backup-Taken-At": takenAt.toISOString(),
      "X-Backup-Taken-By": context.user.name ?? context.user.email,
    },
  });
}
