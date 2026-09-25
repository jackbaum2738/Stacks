import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser, getLibraryByCode } from "@/lib/auth";
import { canEditLibrary, canManageLibrarySettings } from "@/lib/permissions";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Resolves the signed-in user for an account-level route (not library-scoped), or a 401. */
export async function requireCurrentUser(): Promise<
  { user: CurrentUser; response: null } | { user: null; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  return { user, response: null };
}

type LibraryOkResult = Extract<Awaited<ReturnType<typeof getLibraryByCode>>, { status: "ok" }>;
type LibraryContext = { user: LibraryOkResult["user"]; membership: LibraryOkResult["membership"]; library: LibraryOkResult["library"] };

const CHECKS: Record<"edit" | "manage", { test: (role: Role) => boolean; message: string }> = {
  edit: { test: canEditLibrary, message: "View-only members can't make changes" },
  manage: { test: canManageLibrarySettings, message: "Only owners and admins can do this" },
};

/**
 * Resolves the library named by a route's "L-XXXXXX" code segment for an API route -- checked
 * against the signed-in user's own memberships, never a cookie, so a request only ever
 * authorizes against the library named in its own URL (see getLibraryByCode in auth.ts) --
 * or returns a 401/403 response. Pass `require: "edit"` for anything that changes library
 * content (scanning, reserving, editing a book) or `require: "manage"` for settings-level
 * actions (shelves, invite links, import, member management) -- see src/lib/permissions.ts
 * for the roles each tier allows.
 */
export async function requireLibraryContext(
  libraryCode: string,
  options?: { require?: "edit" | "manage" }
): Promise<{ context: LibraryContext; response: null } | { context: null; response: NextResponse }> {
  const result = await getLibraryByCode(libraryCode);
  if (result.status === "unauthenticated") {
    return { context: null, response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  if (result.status === "forbidden") {
    return { context: null, response: NextResponse.json({ error: "Library not found" }, { status: 404 }) };
  }
  const context: LibraryContext = { user: result.user, membership: result.membership, library: result.library };
  if (options?.require) {
    const check = CHECKS[options.require];
    if (!check.test(context.membership.role)) {
      return { context: null, response: NextResponse.json({ error: check.message }, { status: 403 }) };
    }
  }
  return { context, response: null };
}
