import { NextResponse } from "next/server";
import { requireLibraryContext } from "@/lib/api-context";
import { BOOKS_EXPORT_COLUMNS, PEOPLE_EXPORT_COLUMNS, toCsv } from "@/lib/csv";
import { createZip } from "@/lib/backup-zip";

/**
 * A blank starting point for import: the same column headings as a real export, no data
 * rows -- a zip of books.csv + people.csv, identical in shape to what a real export
 * produces for a library with zero copies and zero people. Either file also imports fine
 * on its own if someone deletes the other before filling it in.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/[libraryCode]/import-template">) {
  const { libraryCode } = await params;
  const { context, response } = await requireLibraryContext(libraryCode);
  if (!context) return response;

  const booksCsv = toCsv([[...BOOKS_EXPORT_COLUMNS]]);
  const peopleCsv = toCsv([[...PEOPLE_EXPORT_COLUMNS]]);
  const zip = await createZip([
    { name: "books.csv", content: booksCsv },
    { name: "people.csv", content: peopleCsv },
  ]);

  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="stacks-import-template.zip"`,
    },
  });
}
