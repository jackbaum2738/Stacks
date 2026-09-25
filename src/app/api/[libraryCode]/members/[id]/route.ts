import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { INVITABLE_ROLES, isInvitableRole } from "@/lib/permissions";

/**
 * Changes a member's role between Admin/Member/View Only. Owner/Admin only, and the Owner's
 * own role can never be touched here -- see the transfer-ownership route, the only way
 * anyone (including the Owner themselves) becomes or stops being Owner.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/[libraryCode]/members/[id]">) {
  const { libraryCode, id } = await ctx.params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "manage" });
  if (!context) return response;

  const body = await request.json().catch(() => null);
  const schema = z.object({ role: z.string() });
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isInvitableRole(parsed.data.role)) {
    return NextResponse.json({ error: `role must be one of ${INVITABLE_ROLES.join(", ")}` }, { status: 400 });
  }
  const target = await prisma.membership.findFirst({ where: { id, libraryId: context.library.id } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Transfer ownership to change the owner's role" }, { status: 409 });
  }

  const updated = await prisma.membership.update({ where: { id }, data: { role: parsed.data.role } });
  return NextResponse.json({ membership: updated });
}

/** Removes a member from the library. Owner/admin only; the Owner can never be removed here. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/[libraryCode]/members/[id]">) {
  const { libraryCode, id } = await ctx.params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "manage" });
  if (!context) return response;
  const target = await prisma.membership.findFirst({ where: { id, libraryId: context.library.id } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (target.role === "OWNER") {
    return NextResponse.json(
      { error: "The owner can't be removed — transfer ownership first, or delete the library instead" },
      { status: 409 }
    );
  }

  await prisma.membership.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
