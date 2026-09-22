import { NextResponse } from "next/server";
import { requireLibraryContext } from "@/lib/api-context";
import { BOOKS_EXPORT_COLUMNS, toCsv } from "@/lib/csv";
import { buildBookExportRows } from "@/lib/library-export";

/**
 * Just the catalog half of a backup, as a single books.csv -- for when you want the library
 * without pulling a full zip. Doesn't touch Library.lastBackupAt/lastBackupByUserId; that
 * marker specifically tracks the full backup (see export/route.ts), not this lighter export.
 */
export async function GET() {
  const { context, response } = await requireLibraryContext({ require: "edit" });
  if (!context) return response;

  const rows = await buildBookExportRows(context.library.id);
  const csv = toCsv([[...BOOKS_EXPORT_COLUMNS], ...rows]);
  const filename = `${context.library.slug}-books-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
