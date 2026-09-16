import { NextResponse } from "next/server";
import { requireLibraryContext } from "@/lib/api-context";
import { EXPORT_COLUMNS, toCsv } from "@/lib/csv";

/**
 * A blank starting point for import: the same column headings as a real export, no data
 * rows -- identical in shape to what a real export produces for a library with zero copies.
 */
export async function GET() {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;

  const csv = toCsv([[...EXPORT_COLUMNS]]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stacks-import-template.csv"`,
    },
  });
}
