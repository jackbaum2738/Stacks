import type { Prisma, PrismaClient } from "@prisma/client";

// Same charset as src/lib/copy-code.ts and src/lib/person-code.ts (excludes 0/O and 1/I/L).
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 10;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `L-${code}`;
}

/**
 * Generates a random "L-XXXXXX" library code that doesn't collide with any existing one --
 * globally unique (unlike Person/Copy codes, which only need to be unique within one library),
 * since this is what routing itself uses to find the library.
 */
export async function generateUniqueLibraryCode(db: PrismaClient | Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = randomCode();
    const existing = await db.library.findFirst({ where: { code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique library code after several attempts");
}
