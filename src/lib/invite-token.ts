import { randomBytes } from "crypto";

/** A URL-safe, hard-to-guess token for a library invite's acceptance link. */
export function generateInviteToken(): string {
  return randomBytes(18).toString("base64url");
}
