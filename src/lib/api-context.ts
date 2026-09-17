import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentLibrary } from "@/lib/auth";
import { canEditLibrary, canManageLibrarySettings } from "@/lib/permissions";

type LibraryContext = NonNullable<Awaited<ReturnType<typeof getCurrentLibrary>>>;

const CHECKS: Record<"edit" | "manage", { test: (role: Role) => boolean; message: string }> = {
  edit: { test: canEditLibrary, message: "View-only members can't make changes" },
  manage: { test: canManageLibrarySettings, message: "Only owners and admins can do this" },
};

/**
 * Resolves the signed-in user's active library for an API route, or returns a 401/403
 * response. Pass `require: "edit"` for anything that changes library content (scanning,
 * reserving, editing a book) or `require: "manage"` for settings-level actions (shelves,
 * invite links, import, member management) -- see src/lib/permissions.ts for the roles
 * each tier allows.
 */
export async function requireLibraryContext(
  options?: { require?: "edit" | "manage" }
): Promise<{ context: LibraryContext; response: null } | { context: null; response: NextResponse }> {
  const context = await getCurrentLibrary();
  if (!context) {
    return { context: null, response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  if (options?.require) {
    const check = CHECKS[options.require];
    if (!check.test(context.membership.role)) {
      return { context: null, response: NextResponse.json({ error: check.message }, { status: 403 }) };
    }
  }
  return { context, response: null };
}
