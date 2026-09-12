import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { generateInviteCode } from "@/lib/invite-code";

function canManageInvites(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

/** Returns the library's current invite code, if one has been generated. */
export async function GET() {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;
  if (!canManageInvites(context.membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can manage invite links" }, { status: 403 });
  }

  return NextResponse.json({ inviteCode: context.library.inviteCode });
}

/** Generates (or regenerates, invalidating any existing link) the library's invite code. */
export async function POST() {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;
  if (!canManageInvites(context.membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can manage invite links" }, { status: 403 });
  }

  let inviteCode = generateInviteCode();
  // Astronomically unlikely to collide, but guard against it rather than assume.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.library.findUnique({ where: { inviteCode } });
    if (!existing) break;
    inviteCode = generateInviteCode();
  }

  await prisma.library.update({ where: { id: context.library.id }, data: { inviteCode } });

  return NextResponse.json({ inviteCode });
}
