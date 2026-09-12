import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public preview of an invite link — just the library name, no auth required. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/invite/[code]">) {
  const { code } = await ctx.params;

  const library = await prisma.library.findUnique({
    where: { inviteCode: code },
    select: { name: true },
  });

  if (!library) return NextResponse.json({ error: "Invite link not found" }, { status: 404 });

  return NextResponse.json({ libraryName: library.name });
}
