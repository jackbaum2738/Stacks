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
 * Starts (or replaces) the pending email change for a user and returns the raw confirm token
 * (and, when rotated, the raw cancel token) to email out -- only their hashes are ever stored,
 * so a database leak alone can't be replayed into hijacking someone's account. The confirm
 * token always rotates, so an old confirm link stops working the moment a new one is issued.
 * The cancel token is deliberately NOT rotated on a plain resend (`rotateCancelToken: false`):
 * the notice email carrying the cancel link is only ever sent once, on a genuinely new request
 * (see the route), so rotating it on every resend would silently invalidate a cancel link
 * already sitting in the old address's inbox. `cancelToken` is only returned when it was
 * actually (re)issued -- callers that pass `rotateCancelToken: false` never send a notice email
 * and so never need it.
 */
export async function issueEmailChangeToken(
  userId: string,
  newEmail: string,
  options: { rotateCancelToken: boolean } = { rotateCancelToken: true }
): Promise<{ token: string; cancelToken?: string }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashEmailChangeToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  if (!options.rotateCancelToken) {
    const updated = await prisma.emailChangeRequest.updateMany({
      where: { userId },
      data: { newEmail, tokenHash, expiresAt, lastSentAt: new Date() },
    });
    if (updated.count > 0) return { token };
    // No existing pending row to keep the cancel token stable on (shouldn't happen for a real
    // resend, since one requires a pending row) -- fall through and issue a fresh one instead.
  }

  const cancelToken = randomBytes(32).toString("base64url");
  const cancelTokenHash = hashEmailChangeToken(cancelToken);
  await prisma.emailChangeRequest.upsert({
    where: { userId },
    create: { userId, newEmail, tokenHash, cancelTokenHash, expiresAt },
    update: { newEmail, tokenHash, cancelTokenHash, expiresAt, lastSentAt: new Date() },
  });
  return { token, cancelToken };
}

export async function getPendingEmailChange(userId: string) {
  return prisma.emailChangeRequest.findUnique({ where: { userId } });
}

export async function cancelEmailChangeRequest(userId: string): Promise<void> {
  await prisma.emailChangeRequest.deleteMany({ where: { userId } });
}

/**
 * Cancels a pending email change by its cancel token -- used by the link in the notice email
 * sent to the OLD address, so that inbox can shut down a change it didn't ask for without
 * signing in. No expiry check: the row's mere existence is "pending" (see CLAUDE.md), so a
 * cancel link stays good for as long as the request itself is still sitting there, even past
 * the 1-hour window the confirm token itself is capped to. Returns the address that would have
 * been switched to, so the landing page can say what it stopped, or null if there was nothing
 * to cancel (already confirmed, already cancelled, or superseded by a newer request).
 */
export async function cancelEmailChangeRequestByToken(cancelToken: string): Promise<{ newEmail: string } | null> {
  const record = await prisma.emailChangeRequest.findUnique({
    where: { cancelTokenHash: hashEmailChangeToken(cancelToken) },
  });
  if (!record) return null;
  await prisma.emailChangeRequest.delete({ where: { id: record.id } });
  return { newEmail: record.newEmail };
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
