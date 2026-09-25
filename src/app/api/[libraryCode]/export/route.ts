import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { BOOKS_EXPORT_COLUMNS, PEOPLE_EXPORT_COLUMNS, toCsv } from "@/lib/csv";
import { createZip } from "@/lib/backup-zip";
import { buildBookExportRows, buildPeopleExportRows } from "@/lib/library-export";

/**
 * A full backup of everything currently in the library, as a zip of two CSVs (books.csv +
 * people.csv) in the same column shape as the import template (see BOOKS_EXPORT_COLUMNS /
 * PEOPLE_EXPORT_COLUMNS) so export -> edit in a spreadsheet -> re-import round-trips
 * cleanly. Two files rather than one: a person-per-copy-row export can only ever list
 * people who currently hold a book, so anyone with zero reservations would be silently
 * dropped from a single combined file. people.csv lists every person regardless. Records
 * who took the backup and when, shown on the Settings page -- the single-file exports at
 * export/books and export/people are lighter-weight siblings that skip that bookkeeping,
 * since "last backup" specifically tracks the full one.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/[libraryCode]/export">) {
  const { libraryCode } = await params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "edit" });
  if (!context) return response;

  const [bookRows, peopleRows] = await Promise.all([
    buildBookExportRows(context.library.id),
    buildPeopleExportRows(context.library.id),
  ]);

  const booksCsv = toCsv([[...BOOKS_EXPORT_COLUMNS], ...bookRows]);
  const peopleCsv = toCsv([[...PEOPLE_EXPORT_COLUMNS], ...peopleRows]);

  const takenAt = new Date();
  await prisma.library.update({
    where: { id: context.library.id },
    data: { lastBackupAt: takenAt, lastBackupByUserId: context.user.id },
  });

  const zip = await createZip([
    { name: "books.csv", content: booksCsv },
    { name: "people.csv", content: peopleCsv },
  ]);
  const filename = `${context.library.slug}-backup-${takenAt.toISOString().slice(0, 10)}.zip`;

  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Read by the Settings page's download handler so it can show the updated
      // "last backup" line immediately, without waiting on a router.refresh()
      // whose timing it can't otherwise be sure has landed.
      "X-Backup-Taken-At": takenAt.toISOString(),
      "X-Backup-Taken-By": context.user.name ?? context.user.email,
    },
  });
}
