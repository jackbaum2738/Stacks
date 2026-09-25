import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";
import { buildLibraryInviteEmail } from "@/lib/emails/library-invite";
import { sendTransactionalEmail } from "@/lib/brevo";
import type { InvitableRole } from "@/lib/permissions";

/** Re-sending too soon spams the invitee's inbox, so re-sends are gated to one per minute
 * per invite -- enforced here (not just disabled in the UI) since two admins could otherwise
 * race the button. */
const RESEND_COOLDOWN_MS = 60_000;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/[libraryCode]/invites/[id]/resend">) {
  const { libraryCode, id } = await ctx.params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "manage" });
  if (!context) return response;
  const invite = await prisma.libraryInvite.findFirst({ where: { id, libraryId: context.library.id } });
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

  const elapsedMs = Date.now() - invite.lastSentAt.getTime();
  if (elapsedMs < RESEND_COOLDOWN_MS) {
    const retryAfterMs = RESEND_COOLDOWN_MS - elapsedMs;
    return NextResponse.json(
      { error: `Please wait ${Math.ceil(retryAfterMs / 1000)}s before resending`, retryAfterMs },
      { status: 429 }
    );
  }

  const updated = await prisma.libraryInvite.update({ where: { id }, data: { lastSentAt: new Date() } });

  const origin = new URL(request.url).origin;
  const acceptUrl = `${origin}/invite/${invite.token}`;
  const emailContent = buildLibraryInviteEmail({
    inviterUsername: context.user.username,
    libraryName: context.library.name,
    role: invite.role as InvitableRole,
    acceptUrl,
    origin,
  });
  await sendTransactionalEmail({
    to: { email: invite.email },
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });

  return NextResponse.json({ ok: true, lastSentAt: updated.lastSentAt });
}
