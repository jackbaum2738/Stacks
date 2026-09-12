import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

function canManageMembers(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

/** Removes a member from the library. Owner/admin only; can't remove the last owner. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/library/members/[id]">) {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;
  if (!canManageMembers(context.membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can remove members" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const target = await prisma.membership.findFirst({ where: { id, libraryId: context.library.id } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (target.role === "OWNER") {
    const ownerCount = await prisma.membership.count({
      where: { libraryId: context.library.id, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Can't remove the only owner of this library" }, { status: 409 });
    }
  }

  await prisma.membership.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
