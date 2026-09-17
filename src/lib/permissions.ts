import type { Role } from "@prisma/client";

/**
 * Role hierarchy, lowest to highest. View Only can only read; Member can also scan/reserve/
 * edit books; Admin can additionally manage shelves, invite links, import, and other members;
 * Owner alone can transfer ownership or delete the library. See CLAUDE.md's "Data model"
 * section for the full rationale and how this reconciles with invite links.
 */
const ROLE_RANK: Record<Role, number> = {
  VIEW_ONLY: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

function atLeast(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/** Scan in/out, reserve/release/edit reservations, edit book details -- everything but settings. */
export function canEditLibrary(role: Role): boolean {
  return atLeast(role, "MEMBER");
}

/** Manage shelves, invite links, CSV import, and other members' roles/removal. */
export function canManageLibrarySettings(role: Role): boolean {
  return atLeast(role, "ADMIN");
}

export function isOwner(role: Role): boolean {
  return role === "OWNER";
}

/** The three roles a library's invite links can grant -- Owner is never one of them. */
export const INVITABLE_ROLES = ["ADMIN", "MEMBER", "VIEW_ONLY"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}
