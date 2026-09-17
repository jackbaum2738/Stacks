"use client";

import { createContext, useContext } from "react";
import type { Role } from "@prisma/client";
import { canEditLibrary, canManageLibrarySettings, isOwner } from "@/lib/permissions";

interface LibraryRoleValue {
  role: Role;
  /** Scan/reserve/edit books — false for View Only. */
  canEdit: boolean;
  /** Shelves, invite links, import, member management — Owner/Admin only. */
  canManage: boolean;
  isOwner: boolean;
}

const LibraryRoleContext = createContext<LibraryRoleValue | null>(null);

export function LibraryRoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  const value: LibraryRoleValue = {
    role,
    canEdit: canEditLibrary(role),
    canManage: canManageLibrarySettings(role),
    isOwner: isOwner(role),
  };
  return <LibraryRoleContext.Provider value={value}>{children}</LibraryRoleContext.Provider>;
}

/** The signed-in user's role/capabilities in the currently active library. */
export function useLibraryRole(): LibraryRoleValue {
  const value = useContext(LibraryRoleContext);
  if (!value) throw new Error("useLibraryRole must be used within a LibraryRoleProvider");
  return value;
}
