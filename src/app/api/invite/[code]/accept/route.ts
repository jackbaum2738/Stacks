import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, setActiveLibraryCookie } from "@/lib/auth";

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/invite/[code]/accept">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { code } = await ctx.params;
  const library = await prisma.library.findUnique({ where: { inviteCode: code } });
  if (!library) return NextResponse.json({ error: "Invite link not found" }, { status: 404 });

  const existing = user.memberships.find((m) => m.libraryId === library.id);
  if (!existing) {
    await prisma.membership.create({ data: { userId: user.id, libraryId: library.id, role: "MEMBER" } });
  }

  await setActiveLibraryCookie(library.id);

  return NextResponse.json({ libraryName: library.name });
}
