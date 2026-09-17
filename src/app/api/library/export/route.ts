import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { applyBookOverride } from "@/lib/book-view";
import { BOOKS_EXPORT_COLUMNS, PEOPLE_EXPORT_COLUMNS, toCsv } from "@/lib/csv";
import { createZip } from "@/lib/backup-zip";

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  REMOVED: "Removed",
};

function formatBirthday(birthday: Date | null): string {
  return birthday ? birthday.toISOString().slice(0, 10) : "";
}

/**
 * A full backup of everything currently in the library, as a zip of two CSVs (books.csv +
 * people.csv) in the same column shape as the import template (see BOOKS_EXPORT_COLUMNS /
 * PEOPLE_EXPORT_COLUMNS) so export -> edit in a spreadsheet -> re-import round-trips
 * cleanly. Two files rather than one: a person-per-copy-row export can only ever list
 * people who currently hold a book, so anyone with zero reservations would be silently
 * dropped from a single combined file. people.csv lists every person regardless. Records
 * who took the backup and when, shown on the Settings page.
 */
export async function GET() {
  const { context, response } = await requireLibraryContext({ require: "edit" });
  if (!context) return response;

  const [copies, people] = await Promise.all([
    prisma.copy.findMany({
      where: { libraryId: context.library.id, status: { not: "REMOVED" } },
      include: {
        book: { include: { overrides: { where: { libraryId: context.library.id } } } },
        shelf: true,
        reservation: { include: { person: true } },
      },
      orderBy: { addedAt: "asc" },
    }),
    prisma.person.findMany({
      where: { libraryId: context.library.id },
      orderBy: { name: "asc" },
    }),
  ]);

  const bookRows = copies.map((copy) => {
    const book = applyBookOverride(copy.book, copy.book.overrides[0]);
    return [
      copy.code,
      copy.book.isbn13,
      book.title,
      book.authors.join("; "),
      book.publisher,
      copy.shelf?.name ?? "",
      STATUS_LABEL[copy.status] ?? copy.status,
      copy.reservation?.person?.name ?? "",
      copy.reservation?.person?.code ?? "",
      copy.notes,
      copy.bookCrossingId,
      copy.addedAt.toISOString().slice(0, 10),
    ];
  });

  const peopleRows = people.map((person) => [
    person.code,
    person.name,
    person.email ?? "",
    person.phone ?? "",
    person.location ?? "",
    formatBirthday(person.birthday),
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
