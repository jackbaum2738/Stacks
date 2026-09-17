import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { generateInviteCode } from "@/lib/invite-code";
import { INVITABLE_ROLES, isInvitableRole, type InvitableRole } from "@/lib/permissions";

const CODE_COLUMN: Record<InvitableRole, "inviteCodeAdmin" | "inviteCodeMember" | "inviteCodeViewOnly"> = {
  ADMIN: "inviteCodeAdmin",
  MEMBER: "inviteCodeMember",
  VIEW_ONLY: "inviteCodeViewOnly",
};

function parseRole(request: Request): InvitableRole | null {
  const role = new URL(request.url).searchParams.get("role");
  return role && isInvitableRole(role) ? role : null;
}

/** Returns the library's current invite codes for all three grantable roles. */
export async function GET(request: Request) {
  const { context, response } = await requireLibraryContext({ require: "manage" });
  if (!context) return response;

  const role = parseRole(request);
  if (role) {
    return NextResponse.json({ inviteCode: context.library[CODE_COLUMN[role]] });
  }

  return NextResponse.json({
    inviteCodes: Object.fromEntries(INVITABLE_ROLES.map((r) => [r, context.library[CODE_COLUMN[r]]])),
  });
}

/** Generates (or regenerates, invalidating the old one) the invite link for one role. */
export async function POST(request: Request) {
  const { context, response } = await requireLibraryContext({ require: "manage" });
  if (!context) return response;

  const role = parseRole(request);
  if (!role) {
    return NextResponse.json({ error: `role must be one of ${INVITABLE_ROLES.join(", ")}` }, { status: 400 });
  }
  const column = CODE_COLUMN[role];

  let inviteCode = generateInviteCode();
  // Astronomically unlikely to collide, but guard against it rather than assume.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.library.findFirst({
      where: { OR: INVITABLE_ROLES.map((r) => ({ [CODE_COLUMN[r]]: inviteCode })) },
    });
    if (!existing) break;
    inviteCode = generateInviteCode();
  }

  await prisma.library.update({ where: { id: context.library.id }, data: { [column]: inviteCode } });

  return NextResponse.json({ inviteCode });
}
