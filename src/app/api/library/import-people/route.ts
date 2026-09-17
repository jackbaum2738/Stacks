import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { generateUniquePersonCode } from "@/lib/person-code";

export const maxDuration = 60;

const rowSchema = z.object({
  personId: z.string().trim().optional(),
  name: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  location: z.string().trim().optional(),
  birthday: z.string().trim().optional(), // yyyy-mm-dd
});

const bodySchema = z.object({ rows: z.array(rowSchema).max(5000), dryRun: z.boolean().optional() });

function parseBirthday(raw: string | undefined): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Imports a standalone people.csv (no books.csv alongside it). Matching is by Person ID
 * only -- exactly like Copy ID, deliberately with no name/email fallback -- so a row with
 * no Person ID, or one this library doesn't recognize, always creates a new Person rather
 * than guessing which existing one it might mean (duplicate names are expected, and
 * matching by email would silently merge two people who happen to share an inbox).
 *
 * Email is this library's one unique-per-person field. A row whose email would collide
 * with a *different* existing person's email skips writing that one field (the rest of the
 * row still applies) rather than failing the whole row, and is tallied separately so the
 * confirm/result screens can call it out.
 *
 * Same dry-run/real-run and per-batch shape as /api/library/import -- see that route's doc
 * comment for why (progressive commits, live ticker via rowResults).
 */
export async function POST(request: Request) {
  const { context, response } = await requireLibraryContext({ require: "manage" });
  if (!context) return response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const libraryId = context.library.id;

  if (parsed.data.dryRun) {
    let newCount = 0;
    let updatedCount = 0;
    let skippedMissingName = 0;
    let emailConflicts = 0;

    for (const row of parsed.data.rows) {
      const existing = row.personId
        ? await prisma.person.findFirst({ where: { libraryId, code: row.personId }, select: { id: true } })
        : null;

      if (existing) {
        updatedCount++;
      } else {
        if (!row.name) {
          skippedMissingName++;
          continue;
        }
        newCount++;
      }

      const email = row.email ? row.email.toLowerCase() : row.email;
      if (email) {
        const clash = await prisma.person.findFirst({
          where: { libraryId, email, ...(existing ? { id: { not: existing.id } } : {}) },
          select: { id: true },
        });
        if (clash) emailConflicts++;
      }
    }

    return NextResponse.json({ newCount, updatedCount, skippedMissingName, emailConflicts });
  }

  const result = await prisma.$transaction(
    async (tx) => {
      let newCount = 0;
      let updatedCount = 0;
      let skippedMissingName = 0;
      let emailConflicts = 0;
      const rowResults: { label: string | null; outcome: "new" | "updated" | "skippedMissingName" }[] = [];

      for (const row of parsed.data.rows) {
        const label = row.name || row.personId || null;
        const existing = row.personId ? await tx.person.findFirst({ where: { libraryId, code: row.personId } }) : null;

        if (!existing && !row.name) {
          skippedMissingName++;
          rowResults.push({ label, outcome: "skippedMissingName" });
          continue;
        }

        let email: string | null | undefined = row.email !== undefined ? (row.email ? row.email.toLowerCase() : null) : undefined;
        if (email) {
          const clash = await tx.person.findFirst({
            where: { libraryId, email, ...(existing ? { id: { not: existing.id } } : {}) },
            select: { id: true },
          });
          if (clash) {
            emailConflicts++;
            email = undefined; // leave the existing value (or blank, on create) alone
          }
        }

        const birthday = parseBirthday(row.birthday);

        if (existing) {
          await tx.person.update({
            where: { id: existing.id },
            data: {
              ...(row.name ? { name: row.name } : {}),
              ...(email !== undefined ? { email } : {}),
              ...(row.phone ? { phone: row.phone } : {}),
              ...(row.location ? { location: row.location } : {}),
              ...(birthday !== undefined ? { birthday } : {}),
            },
          });
          updatedCount++;
          rowResults.push({ label, outcome: "updated" });
        } else {
          const code = await generateUniquePersonCode(tx, libraryId);
          await tx.person.create({
            data: {
              libraryId,
              name: row.name!,
              email: email || null,
              phone: row.phone || null,
              location: row.location || null,
              birthday: birthday || null,
              code,
            },
          });
          newCount++;
          rowResults.push({ label, outcome: "new" });
        }
      }

      return { newCount, updatedCount, skippedMissingName, emailConflicts, rowResults };
    },
    { timeout: 30000 }
  );

  return NextResponse.json(result);
}
