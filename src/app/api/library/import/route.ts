import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { cleanIsbn, isValidIsbn, toIsbn13 } from "@/lib/isbn";
import { generateUniqueCopyCode } from "@/lib/copy-code";

// Every row here is pure DB work (import deliberately never calls the external ISBN
// lookup -- see CLAUDE.md/IDEAS.md design notes), but a few hundred rows of sequential
// awaits still deserves more headroom than the platform default.
export const maxDuration = 60;

const rowSchema = z.object({
  copyId: z.string().trim().optional(),
  isbn: z.string().trim().optional(),
  title: z.string().trim().optional(),
  authors: z.string().trim().optional(),
  publisher: z.string().trim().optional(),
  shelf: z.string().trim().optional(),
  status: z.string().trim().optional(),
  reservedFor: z.string().trim().optional(),
  contact: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  bookCrossingId: z.string().trim().optional(),
});

const bodySchema = z.object({ rows: z.array(rowSchema).max(5000), dryRun: z.boolean().optional() });

function parseAuthors(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

function normalizeStatus(raw: string | undefined): "AVAILABLE" | "RESERVED" | "REMOVED" | undefined {
  const upper = raw?.trim().toUpperCase();
  if (upper === "AVAILABLE" || upper === "RESERVED" || upper === "REMOVED") return upper;
  return undefined;
}

/**
 * Bulk-imports a CSV that's already been parsed and column-mapped client-side. Design
 * recap (agreed with the user before building):
 *  - Matching is by Copy ID (the short "C-XXXXXX" code from src/lib/copy-code.ts, not the
 *    internal database id), not ISBN. A row with no Copy ID, or one this library doesn't
 *    recognize, always creates a new Copy -- even if the book itself is already owned
 *    under that ISBN (a second physical copy is never merged into the first).
 *  - Rows already in this library that are missing from the file are left completely
 *    alone; this endpoint never deletes or looks at copies outside the rows it's given.
 *  - A brand-new ISBN never triggers an external lookup here. It gets a bare `Book`
 *    placeholder marked "manual-unresolved" (same marker scan-in already uses and already
 *    retries automatically), so a real book many libraries never re-scan doesn't need one.
 *  - Book-content fields (title/authors/publisher) a row supplies are written as this
 *    library's BookOverride, never onto the shared Book row -- so an import can't corrupt
 *    what another library sharing the ISBN sees. A row with no title data leaves the
 *    canonical Book (or existing override) exactly as it was.
 *  - An update to an existing copy only touches the fields the row actually supplies;
 *    blank cells leave the existing value alone rather than clearing it.
 *
 * Pass `dryRun: true` to get back the same new/updated/skipped counts the real import
 * would produce -- used to populate the confirm screen before anything is written -- with
 * no side effects at all (read-only Copy ID lookups, no Book/Shelf/Reservation writes).
 *
 * The real (non-dry-run) import is called once per batch of rows, not once for the whole
 * file -- the client (src/components/backup-import-section.tsx) splits a large file into
 * small chunks and calls this endpoint once per chunk, each one committing fully before the
 * next is sent. That's what makes closing the tab mid-import merely incomplete rather than
 * corrupting: only the batch actually in flight is ever at risk, everything before it is
 * already durably saved. `rowResults` (per-row label + outcome, in order) is what lets the
 * client animate a smooth live progress ticker across however many batches that takes.
 */
export async function POST(request: Request) {
  const { context, response } = await requireLibraryContext({ require: "manage" });
  if (!context) return response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const libraryId = context.library.id;
  const userId = context.user.id;

  if (parsed.data.dryRun) {
    let newCount = 0;
    let updatedCount = 0;
    let skippedMissingIsbn = 0;
    let skippedInvalidIsbn = 0;

    for (const row of parsed.data.rows) {
      const rawIsbn = row.isbn ?? "";
      if (!rawIsbn) {
        skippedMissingIsbn++;
        continue;
      }
      if (!isValidIsbn(cleanIsbn(rawIsbn))) {
        skippedInvalidIsbn++;
        continue;
      }
      const existingCopy = row.copyId
        ? await prisma.copy.findFirst({ where: { code: row.copyId, libraryId }, select: { id: true } })
        : null;
      if (existingCopy) updatedCount++;
      else newCount++;
    }

    return NextResponse.json({ newCount, updatedCount, skippedMissingIsbn, skippedInvalidIsbn });
  }

  const result = await prisma.$transaction(
    async (tx) => {
      let newCount = 0;
      let updatedCount = 0;
      let skippedMissingIsbn = 0;
      let skippedInvalidIsbn = 0;
      // Per-row outcome, in input order -- lets the client drive a live progress ticker
      // across however many of these batched requests a large import takes, without it
      // having to guess at pacing from the aggregate counts alone.
      const rowResults: { label: string | null; outcome: "new" | "updated" | "skippedMissingIsbn" | "skippedInvalidIsbn" }[] = [];
      const shelfCache = new Map<string, string>();

      async function resolveShelfId(shelfNameRaw: string): Promise<string | null> {
        const name = shelfNameRaw.trim();
        if (!name) return null;
        const cacheKey = name.toLowerCase();
        const cached = shelfCache.get(cacheKey);
        if (cached) return cached;

        const existing = await tx.shelf.findFirst({
          where: { libraryId, name: { equals: name, mode: "insensitive" } },
        });
        const shelf = existing ?? (await tx.shelf.create({ data: { libraryId, name } }));
        shelfCache.set(cacheKey, shelf.id);
        return shelf.id;
      }

      for (const row of parsed.data.rows) {
        const label = row.title || row.isbn || null;
        const rawIsbn = row.isbn ?? "";
        if (!rawIsbn) {
          skippedMissingIsbn++;
          rowResults.push({ label, outcome: "skippedMissingIsbn" });
          continue;
        }
        const cleaned = cleanIsbn(rawIsbn);
        if (!isValidIsbn(cleaned)) {
          skippedInvalidIsbn++;
          rowResults.push({ label, outcome: "skippedInvalidIsbn" });
          continue;
        }
        const isbn13 = toIsbn13(cleaned);

        const titleRaw = row.title ?? "";
        const hasBookData = titleRaw.length > 0;

        let book = await tx.book.findUnique({ where: { isbn13 } });
        if (!book) {
          book = await tx.book.create({
            data: {
              isbn13,
              isbn10: cleaned.length === 10 ? cleaned : null,
              title: `Unknown title (ISBN ${isbn13})`,
              authors: [],
              source: "manual-unresolved",
            },
          });
        }

        if (hasBookData) {
          const overrideFields = { title: titleRaw, authors: parseAuthors(row.authors), publisher: row.publisher || null };
          await tx.bookOverride.upsert({
            where: { bookId_libraryId: { bookId: book.id, libraryId } },
            create: { bookId: book.id, libraryId, ...overrideFields },
            update: overrideFields,
          });
        }

        const existingCopy = row.copyId
          ? await tx.copy.findFirst({ where: { code: row.copyId, libraryId }, include: { reservation: true } })
          : null;

        const shelfId = row.shelf ? await resolveShelfId(row.shelf) : undefined;
        const requestedStatus = normalizeStatus(row.status);
        const reservedFor = row.reservedFor ?? "";
        // RESERVED needs a name to hang the reservation on; without one, fall back to
        // AVAILABLE rather than create a Reservation row with a blank required field.
        const status = requestedStatus === "RESERVED" && !reservedFor ? "AVAILABLE" : requestedStatus;

        if (existingCopy) {
          await tx.copy.update({
            where: { id: existingCopy.id },
            data: {
              ...(shelfId !== undefined ? { shelfId } : {}),
              ...(status ? { status } : {}),
              ...(row.notes ? { notes: row.notes } : {}),
              ...(row.bookCrossingId ? { bookCrossingId: row.bookCrossingId } : {}),
            },
          });

          if (status === "RESERVED" && reservedFor) {
            await tx.reservation.upsert({
              where: { copyId: existingCopy.id },
              create: { copyId: existingCopy.id, reservedFor, contact: row.contact || null, createdById: userId },
              update: { reservedFor, contact: row.contact || null },
            });
          } else if (status && status !== "RESERVED" && existingCopy.reservation) {
            // Releasing a reservation must delete the row, not flag it -- Reservation.copyId
            // is unique, so leaving a released row behind would make this copy permanently
            // unreservable again (see CLAUDE.md's reservation-release bug).
            await tx.reservation.delete({ where: { copyId: existingCopy.id } });
          }

          updatedCount++;
          rowResults.push({ label, outcome: "updated" });
        } else {
          const code = await generateUniqueCopyCode(tx, libraryId);
          const created = await tx.copy.create({
            data: {
              libraryId,
              bookId: book.id,
              shelfId: shelfId || null,
              status: status ?? "AVAILABLE",
              notes: row.notes || null,
              bookCrossingId: row.bookCrossingId || null,
              code,
            },
          });

          if (status === "RESERVED" && reservedFor) {
            await tx.reservation.create({
              data: { copyId: created.id, reservedFor, contact: row.contact || null, createdById: userId },
            });
          }

          newCount++;
          rowResults.push({ label, outcome: "new" });
        }
      }

      return { newCount, updatedCount, skippedMissingIsbn, skippedInvalidIsbn, rowResults };
    },
    { timeout: 30000 }
  );

  return NextResponse.json(result);
}
