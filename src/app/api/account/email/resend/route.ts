import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/api-context";
import { EMAIL_CHANGE_RESEND_COOLDOWN_MS, getPendingEmailChange, issueEmailChangeToken } from "@/lib/email-change";
import { sendTransactionalEmail } from "@/lib/brevo";
import { buildEmailChangeVerifyEmail } from "@/lib/emails/email-change-verify";

/** Plain re-send of the pending verification link -- no password required, since it doesn't
 * change what address is pending, only re-delivers the same request. Cooldown-gated same as
 * PATCH's own resend path. Only ever emails the pending (new) address, never the old one
 * again. */
export async function POST(request: Request) {
  const { user, response } = await requireCurrentUser();
  if (!user) return response;

  const pending = await getPendingEmailChange(user.id);
  if (!pending) {
    return NextResponse.json({ error: "There's no pending email change to resend." }, { status: 404 });
  }

  const elapsedMs = Date.now() - pending.lastSentAt.getTime();
  if (elapsedMs < EMAIL_CHANGE_RESEND_COOLDOWN_MS) {
    const retryAfterMs = EMAIL_CHANGE_RESEND_COOLDOWN_MS - elapsedMs;
    return NextResponse.json(
      { error: `Please wait ${Math.ceil(retryAfterMs / 1000)}s before resending`, retryAfterMs },
      { status: 429 }
    );
  }

  const origin = new URL(request.url).origin;
  // Never re-notifies the old address, so the cancel token (only ever mailed in that notice)
  // must stay stable here -- otherwise a plain resend would silently kill a cancel link already
  // sitting in that inbox. See src/lib/email-change.ts.
  const { token } = await issueEmailChangeToken(user.id, pending.newEmail, { rotateCancelToken: false });
  const confirmUrl = `${origin}/confirm-email?token=${token}`;

  const verifyEmail = buildEmailChangeVerifyEmail({ username: user.username, confirmUrl, origin });
  await sendTransactionalEmail({
    to: { email: pending.newEmail, name: user.name ?? undefined },
    subject: verifyEmail.subject,
    html: verifyEmail.html,
    text: verifyEmail.text,
  });

  return NextResponse.json({ ok: true, lastSentAt: new Date().toISOString() });
}
