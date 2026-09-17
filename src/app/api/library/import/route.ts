import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { cleanIsbn, isValidIsbn, toIsbn13 } from "@/lib/isbn";
import { generateUniqueCopyCode } from "@/lib/copy-code";
import { generateUniquePersonCode } from "@/lib/person-code";

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
  reservedForPersonId: z.string().trim().optional(),
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

type PersonOutcome = "matched" | "created" | "none";

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
 *  - Reservee resolution (see resolvePerson below) mirrors Copy ID exactly: a row whose
 *    "Reserved For Person ID" matches an existing person in this library uses that person
 *    outright; a row with a Person ID that doesn't match always creates a brand-new person
 *    rather than falling back to guessing by name (same as an unrecognized Copy ID always
 *    creating a new Copy rather than merging into an existing one). Only a *blank* Person
 *    ID cell falls back to matching by name: no name match creates a person (mirroring how
 *    an unrecognized shelf name auto-creates a Shelf), exactly one match reuses them, and
 *    two or more matches always creates a new person rather than guessing which one --
 *    duplicate names are expected now that Person.name isn't unique.
 *
 * Pass `dryRun: true` to get back the same new/updated/skipped counts (and people
 * matched/created counts) the real import would produce -- used to populate the confirm
 * screen before anything is written -- with no side effects at all.
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
    let peopleNewCount = 0;
    let peopleMatchedCount = 0;
    // Simulates the transaction's "read your own writes" behavior for a person created
    // earlier in this same dry run, so a second row reserving the same brand-new name is
    // counted as a match against them rather than as a second "new person".
    const pendingPeopleByName = new Set<string>();

    async function dryResolvePerson(nameRaw: string, personIdRaw: string | undefined): Promise<PersonOutcome> {
      const name = nameRaw.trim();
      const personCode = personIdRaw?.trim();
      if (personCode) {
        const existing = await prisma.person.findFirst({ where: { libraryId, code: personCode }, select: { id: true } });
        if (existing) return "matched";
      } else if (name) {
        const key = name.toLowerCase();
        if (pendingPeopleByName.has(key)) return "matched";
        const matches = await prisma.person.findMany({
          where: { libraryId, name: { equals: name, mode: "insensitive" } },
          select: { id: true },
        });
        if (matches.length === 1) return "matched";
      }
      if (!name) return "none";
      pendingPeopleByName.add(name.toLowerCase());
      return "created";
    }

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

      if (normalizeStatus(row.status) === "RESERVED") {
        const outcome = await dryResolvePerson(row.reservedFor ?? "", row.reservedForPersonId);
        if (outcome === "matched") peopleMatchedCount++;
        else if (outcome === "created") peopleNewCount++;
      }
    }

    return NextResponse.json({
      newCount,
      updatedCount,
      skippedMissingIsbn,
      skippedInvalidIsbn,
      peopleNewCount,
      peopleMatchedCount,
    });
  }

  const result = await prisma.$transaction(
    async (tx) => {
      let newCount = 0;
      let updatedCount = 0;
      let skippedMissingIsbn = 0;
      let skippedInvalidIsbn = 0;
      let peopleNewCount = 0;
      let peopleMatchedCount = 0;
      // Per-row outcome, in input order -- lets the client drive a live progress ticker
      // across however many of these batched requests a large import takes, without it
      // having to guess at pacing from the aggregate counts alone.
      const rowResults: {
        label: string | null;
        outcome: "new" | "updated" | "skippedMissingIsbn" | "skippedInvalidIsbn";
        personOutcome: PersonOutcome | null;
      }[] = [];
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

      async function resolvePerson(
        nameRaw: string,
        personIdRaw: string | undefined
      ): Promise<{ personId: string | null; outcome: PersonOutcome }> {
        const name = nameRaw.trim();
        const personCode = personIdRaw?.trim();

        if (personCode) {
          const existing = await tx.person.findFirst({ where: { libraryId, code: personCode } });
          if (existing) return { personId: existing.id, outcome: "matched" };
          // Unrecognized Person ID: always create new, mirroring an unrecognized Copy ID.
        } else if (name) {
          const matches = await tx.person.findMany({
            where: { libraryId, name: { equals: name, mode: "insensitive" } },
            select: { id: true },
          });
          if (matches.length === 1) return { personId: matches[0].id, outcome: "matched" };
        }

        if (!name) return { personId: null, outcome: "none" };
        const code = await generateUniquePersonCode(tx, libraryId);
        const created = await tx.person.create({ data: { libraryId, name, code } });
        return { personId: created.id, outcome: "created" };
      }

      for (const row of parsed.data.rows) {
        const label = row.title || row.isbn || null;
        const rawIsbn = row.isbn ?? "";
        if (!rawIsbn) {
          skippedMissingIsbn++;
          rowResults.push({ label, outcome: "skippedMissingIsbn", personOutcome: null });
          continue;
        }
        const cleaned = cleanIsbn(rawIsbn);
        if (!isValidIsbn(cleaned)) {
          skippedInvalidIsbn++;
          rowResults.push({ label, outcome: "skippedInvalidIsbn", personOutcome: null });
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

        let personResult: { personId: string | null; outcome: PersonOutcome } = { personId: null, outcome: "none" };
        if (requestedStatus === "RESERVED") {
          personResult = await resolvePerson(row.reservedFor ?? "", row.reservedForPersonId);
        }
        // RESERVED needs a person to hang the reservation on; without one, fall back to
        // AVAILABLE rather than create a Reservation row with no person attached.
        const status = requestedStatus === "RESERVED" && !personResult.personId ? "AVAILABLE" : requestedStatus;
        if (personResult.outcome === "matched") peopleMatchedCount++;
        else if (personResult.outcome === "created") peopleNewCount++;

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

          if (status === "RESERVED" && personResult.personId) {
            await tx.reservation.upsert({
              where: { copyId: existingCopy.id },
              create: { copyId: existingCopy.id, personId: personResult.personId, createdById: userId },
              update: { personId: personResult.personId },
            });
          } else if (status && status !== "RESERVED" && existingCopy.reservation) {
            // Releasing a reservation must delete the row, not flag it -- Reservation.copyId
            // is unique, so leaving a released row behind would make this copy permanently
            // unreservable again (see CLAUDE.md's reservation-release bug).
            await tx.reservation.delete({ where: { copyId: existingCopy.id } });
          }

          updatedCount++;
          rowResults.push({ label, outcome: "updated", personOutcome: requestedStatus === "RESERVED" ? personResult.outcome : null });
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

          if (status === "RESERVED" && personResult.personId) {
            await tx.reservation.create({
              data: { copyId: created.id, personId: personResult.personId, createdById: userId },
            });
          }

          newCount++;
          rowResults.push({ label, outcome: "new", personOutcome: requestedStatus === "RESERVED" ? personResult.outcome : null });
        }
      }

      return { newCount, updatedCount, skippedMissingIsbn, skippedInvalidIsbn, peopleNewCount, peopleMatchedCount, rowResults };
    },
    { timeout: 30000 }
  );

  return NextResponse.json(result);
}
