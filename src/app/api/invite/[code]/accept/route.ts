import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, setActiveLibraryCookie } from "@/lib/auth";
import { findLibraryByInviteCode } from "@/lib/invite-code";

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/invite/[code]/accept">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { code } = await ctx.params;
  const found = await findLibraryByInviteCode(code);
  if (!found) {
    return NextResponse.json(
      { error: "This link is no longer valid — contact the library owner to request a new one." },
      { status: 404 }
    );
  }
  const { library, role } = found;

  const existing = user.memberships.find((m) => m.libraryId === library.id);
  if (!existing) {
    await prisma.membership.create({ data: { userId: user.id, libraryId: library.id, role } });
  }

  await setActiveLibraryCookie(library.id);

  return NextResponse.json({ libraryName: library.name });
}
