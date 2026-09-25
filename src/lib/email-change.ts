import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

/** Re-sending too soon spams the new address's inbox -- same 60s pattern as LibraryInvite
 * resend, but this only gates re-sending to the SAME pending address (see route). */
export const EMAIL_CHANGE_RESEND_COOLDOWN_MS = 60_000;

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, same window as password reset

function hashEmailChangeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Starts (or replaces) the pending email change for a user and returns the raw token to email
 * out -- only its hash is ever stored, so a database leak alone can't be replayed into
 * hijacking someone's account. Always rotates the token, even when the target address is
 * unchanged, so an old link stops working the moment a new one is issued.
 */
export async function issueEmailChangeToken(userId: string, newEmail: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashEmailChangeToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.emailChangeRequest.upsert({
    where: { userId },
    create: { userId, newEmail, tokenHash, expiresAt },
    update: { newEmail, tokenHash, expiresAt, lastSentAt: new Date() },
  });
  return token;
}

export async function getPendingEmailChange(userId: string) {
  return prisma.emailChangeRequest.findUnique({ where: { userId } });
}

export async function cancelEmailChangeRequest(userId: string): Promise<void> {
  await prisma.emailChangeRequest.deleteMany({ where: { userId } });
}

/**
 * Validates a raw confirmation token (not expired) and, if valid, commits the email change and
 * deletes the pending row in one transaction so a token can never be consumed twice. Returns
 * the new email on success, or null if the token is missing or expired. Also treats a race
 * where the address was claimed by another account in the meantime (a unique-constraint
 * failure on the update) as an invalid token, since the change genuinely can't complete.
 */
export async function consumeEmailChangeToken(token: string): Promise<{ email: string } | null> {
  const record = await prisma.emailChangeRequest.findUnique({ where: { tokenHash: hashEmailChangeToken(token) } });
  if (!record || record.expiresAt < new Date()) return null;

  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { email: record.newEmail } }),
      prisma.emailChangeRequest.delete({ where: { id: record.id } }),
    ]);
  } catch {
    await prisma.emailChangeRequest.deleteMany({ where: { id: record.id } });
    return null;
  }
  return { email: record.newEmail };
}
