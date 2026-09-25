import { NextResponse } from "next/server";
import { requireLibraryContext } from "@/lib/api-context";
import { PEOPLE_EXPORT_COLUMNS, toCsv } from "@/lib/csv";
import { buildPeopleExportRows } from "@/lib/library-export";

/**
 * Just the People directory, as a single people.csv, independent of who currently has a
 * book reserved -- see buildPeopleExportRows. Doesn't touch Library.lastBackupAt/
 * lastBackupByUserId; that marker specifically tracks the full backup (see export/route.ts).
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/[libraryCode]/export/people">) {
  const { libraryCode } = await params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "edit" });
  if (!context) return response;

  const rows = await buildPeopleExportRows(context.library.id);
  const csv = toCsv([[...PEOPLE_EXPORT_COLUMNS], ...rows]);
  const filename = `${context.library.slug}-people-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
