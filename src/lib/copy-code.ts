import type { Prisma, PrismaClient } from "@prisma/client";

// Excludes 0/O and 1/I/L -- easy to confuse when read off a spreadsheet or written down
// by hand for a book being mailed out.
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 10;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `C-${code}`;
}

/**
 * Generates a random "C-XXXXXX" copy code that doesn't collide with an existing one in
 * this library (codes are deliberately random rather than sequential -- explicit user
 * choice -- and only need to be unique within a library, never across libraries, since
 * every lookup is already scoped by libraryId first).
 */
export async function generateUniqueCopyCode(
  db: PrismaClient | Prisma.TransactionClient,
  libraryId: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = randomCode();
    const existing = await db.copy.findFirst({ where: { libraryId, code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique copy code after several attempts");
}
