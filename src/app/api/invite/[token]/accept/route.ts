import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, setActiveLibraryCookie } from "@/lib/auth";

/**
 * Confirms joining a library from an emailed invite -- the second step Jack asked for, always
 * shown after sign-in/sign-up rather than joining the moment the link is clicked. Creating the
 * membership and deleting the invite happen in one transaction so a race (e.g. the invite being
 * cancelled the instant this runs) can't leave a membership without ever having consumed the
 * invite, or vice versa.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/invite/[token]/accept">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { token } = await ctx.params;
  const invite = await prisma.libraryInvite.findUnique({ where: { token }, include: { library: true } });
  if (!invite) {
    return NextResponse.json(
      { error: "This link is no longer valid — contact the library owner to request a new one." },
      { status: 404 }
    );
  }

  const alreadyMember = user.memberships.some((m) => m.libraryId === invite.libraryId);

  await prisma.$transaction([
    ...(alreadyMember
      ? []
      : [prisma.membership.create({ data: { userId: user.id, libraryId: invite.libraryId, role: invite.role } })]),
    prisma.libraryInvite.delete({ where: { id: invite.id } }),
  ]);

  await setActiveLibraryCookie(invite.libraryId);

  return NextResponse.json({ libraryName: invite.library.name });
}
