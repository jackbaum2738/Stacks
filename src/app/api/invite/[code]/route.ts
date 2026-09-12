import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public preview of an invite link — library name and inviter's name, no auth required. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/invite/[code]">) {
  const { code } = await ctx.params;

  const library = await prisma.library.findUnique({
    where: { inviteCode: code },
    select: {
      name: true,
      memberships: {
        where: { role: "OWNER" },
        take: 1,
        select: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!library) return NextResponse.json({ error: "Invite link not found" }, { status: 404 });

  const owner = library.memberships[0]?.user;

  return NextResponse.json({
    libraryName: library.name,
    inviterName: owner?.name || owner?.email || null,
  });
}
