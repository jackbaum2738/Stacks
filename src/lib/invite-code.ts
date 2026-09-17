import { randomBytes } from "crypto";
import type { Library } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INVITABLE_ROLES, type InvitableRole } from "@/lib/permissions";

/** A URL-safe, hard-to-guess code for library invite links. */
export function generateInviteCode(): string {
  return randomBytes(18).toString("base64url");
}

const CODE_COLUMN: Record<InvitableRole, "inviteCodeAdmin" | "inviteCodeMember" | "inviteCodeViewOnly"> = {
  ADMIN: "inviteCodeAdmin",
  MEMBER: "inviteCodeMember",
  VIEW_ONLY: "inviteCodeViewOnly",
};

/** Finds the library an invite code belongs to and which role it grants (any of the three). */
export async function findLibraryByInviteCode(
  code: string
): Promise<{ library: Library; role: InvitableRole } | null> {
  const library = await prisma.library.findFirst({
    where: { OR: INVITABLE_ROLES.map((role) => ({ [CODE_COLUMN[role]]: code })) },
  });
  if (!library) return null;

  const role = INVITABLE_ROLES.find((r) => library[CODE_COLUMN[r]] === code);
  if (!role) return null;

  return { library, role };
}
