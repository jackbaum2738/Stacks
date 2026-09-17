import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findLibraryByInviteCode } from "@/lib/invite-code";

/** Public preview of an invite link — library name, inviter's name, and granted role, no auth required. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/invite/[code]">) {
  const { code } = await ctx.params;

  const found = await findLibraryByInviteCode(code);
  if (!found) return NextResponse.json({ error: "Invite link not found" }, { status: 404 });

  const owner = await prisma.membership.findFirst({
    where: { libraryId: found.library.id, role: "OWNER" },
    select: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({
    libraryName: found.library.name,
    inviterName: owner?.user.name || owner?.user.email || null,
    role: found.role,
  });
}
