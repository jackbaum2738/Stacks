import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { generateInviteToken } from "@/lib/invite-token";
import { isValidEmailShape } from "@/lib/account-validation";
import { buildLibraryInviteEmail } from "@/lib/emails/library-invite";
import { sendTransactionalEmail } from "@/lib/brevo";
import { INVITABLE_ROLES, isInvitableRole } from "@/lib/permissions";

/** Lists this library's open (unaccepted, uncancelled) invites -- Admin+ only. */
export async function GET() {
  const { context, response } = await requireLibraryContext({ require: "manage" });
  if (!context) return response;

  const invites = await prisma.libraryInvite.findMany({
    where: { libraryId: context.library.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invites });
}

const schema = z.object({
  email: z.string().trim().toLowerCase(),
  role: z.string(),
});

/**
 * Sends a new emailed invite. Admin+ only, same tier the old per-role invite links required.
 * Rejects an email that's already a member (nothing to invite) or already has an open invite
 * for this library (the Invitations tab's Cancel/Resend cover that case instead of
 * silently creating a second one, which the libraryId+email unique constraint would reject
 * anyway).
 */
export async function POST(request: NextRequest) {
  const { context, response } = await requireLibraryContext({ require: "manage" });
  if (!context) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success || !isValidEmailShape(parsed.data.email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  if (!isInvitableRole(parsed.data.role)) {
    return NextResponse.json({ error: `role must be one of ${INVITABLE_ROLES.join(", ")}` }, { status: 400 });
  }
  const { email, role } = parsed.data;

  const existingMember = await prisma.membership.findFirst({
    where: { libraryId: context.library.id, user: { email } },
  });
  if (existingMember) {
    return NextResponse.json({ error: "That email already belongs to a member of this library" }, { status: 409 });
  }

  const existingInvite = await prisma.libraryInvite.findUnique({
    where: { libraryId_email: { libraryId: context.library.id, email } },
  });
  if (existingInvite) {
    return NextResponse.json(
      { error: "There's already an open invitation for that email — cancel or resend it from Invitations" },
      { status: 409 }
    );
  }

  const token = generateInviteToken();
  const invite = await prisma.libraryInvite.create({
    data: { libraryId: context.library.id, email, role, token, invitedById: context.user.id },
  });

  const origin = new URL(request.url).origin;
  const acceptUrl = `${origin}/invite/${token}`;
  const emailContent = buildLibraryInviteEmail({
    inviterUsername: context.user.username,
    libraryName: context.library.name,
    role,
    acceptUrl,
    origin,
  });
  await sendTransactionalEmail({ to: { email }, subject: emailContent.subject, html: emailContent.html, text: emailContent.text });

  return NextResponse.json({ invite });
}
