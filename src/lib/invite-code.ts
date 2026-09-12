import { randomBytes } from "crypto";

/** A URL-safe, hard-to-guess code for library invite links. */
export function generateInviteCode(): string {
  return randomBytes(18).toString("base64url");
}
