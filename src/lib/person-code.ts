import type { Prisma, PrismaClient } from "@prisma/client";

// Same charset as src/lib/copy-code.ts (excludes 0/O/1/I/L) so Person IDs read the same
// way Copy IDs do -- distinct prefix, same visual format.
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 10;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `P-${code}`;
}

/**
 * Generates a random "P-XXXXXX" person ID that doesn't collide with an existing one in
 * this library -- unique per-library only, same as Copy.code, since every lookup is
 * already scoped by libraryId first.
 */
export async function generateUniquePersonCode(
  db: PrismaClient | Prisma.TransactionClient,
  libraryId: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = randomCode();
    const existing = await db.person.findFirst({ where: { libraryId, code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique person code after several attempts");
}
