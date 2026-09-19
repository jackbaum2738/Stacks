import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public preview of an invite -- library name, inviter's username, and granted role, no auth required. */
export async function GET(_request: Request, ctx: RouteContext<"/api/invite/[token]">) {
  const { token } = await ctx.params;

  const invite = await prisma.libraryInvite.findUnique({
    where: { token },
    include: { library: { select: { name: true } }, invitedBy: { select: { username: true } } },
  });
  if (!invite) return NextResponse.json({ error: "Invite link not found" }, { status: 404 });

  return NextResponse.json({
    libraryName: invite.library.name,
    inviterUsername: invite.invitedBy?.username ?? null,
    role: invite.role,
  });
}
