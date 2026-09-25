import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/api-context";
import { verifyPassword } from "@/lib/auth";
import { isValidEmailShape } from "@/lib/account-validation";
import { EMAIL_CHANGE_RESEND_COOLDOWN_MS, cancelEmailChangeRequest, getPendingEmailChange, issueEmailChangeToken } from "@/lib/email-change";
import { sendTransactionalEmail } from "@/lib/brevo";
import { buildEmailChangeVerifyEmail } from "@/lib/emails/email-change-verify";
import { buildEmailChangeNoticeEmail } from "@/lib/emails/email-change-notice";

const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidEmailShape, { message: "Enter a valid email" }),
  currentPassword: z.string().min(1),
});

/**
 * Starts (or re-drives) an email change. Doesn't touch User.email directly -- see
 * src/lib/email-change.ts and CLAUDE.md's email-change notes -- it only ever issues a
 * verification token, and the actual column update happens when that link is clicked. Re-
 * submitting the SAME address that's already pending is treated as a resend and is cooldown-
 * gated; a genuinely different address always goes through immediately.
 */
export async function PATCH(request: Request) {
  const { user, response } = await requireCurrentUser();
  if (!user) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email } = parsed.data;

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "That password isn't right" }, { status: 401 });
  }

  if (email === user.email.toLowerCase()) {
    return NextResponse.json({ error: "That's already your email." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "That email is already associated with a Stacks account." }, { status: 409 });
  }

  const pending = await getPendingEmailChange(user.id);
  const isResendOfSamePending = !!pending && pending.newEmail === email;

  if (isResendOfSamePending) {
    const elapsedMs = Date.now() - pending.lastSentAt.getTime();
    if (elapsedMs < EMAIL_CHANGE_RESEND_COOLDOWN_MS) {
      const retryAfterMs = EMAIL_CHANGE_RESEND_COOLDOWN_MS - elapsedMs;
      return NextResponse.json(
        { error: `Please wait ${Math.ceil(retryAfterMs / 1000)}s before resending`, retryAfterMs },
        { status: 429 }
      );
    }
  }

  const origin = new URL(request.url).origin;
  const token = await issueEmailChangeToken(user.id, email);
  const confirmUrl = `${origin}/confirm-email?token=${token}`;

  const verifyEmail = buildEmailChangeVerifyEmail({ username: user.username, confirmUrl, origin });
  await sendTransactionalEmail({
    to: { email, name: user.name ?? undefined },
    subject: verifyEmail.subject,
    html: verifyEmail.html,
    text: verifyEmail.text,
  });

  // A resend of the same pending link doesn't re-notify the old address -- only a genuinely
  // new (or first) request does.
  if (!isResendOfSamePending) {
    const noticeEmail = buildEmailChangeNoticeEmail({ username: user.username, newEmail: email, origin });
    await sendTransactionalEmail({
      to: { email: user.email, name: user.name ?? undefined },
      subject: noticeEmail.subject,
      html: noticeEmail.html,
      text: noticeEmail.text,
    });
  }

  return NextResponse.json({ pendingEmail: email, lastSentAt: new Date().toISOString() });
}

/** Cancels a pending email change outright -- no password required, since this only removes a
 * pending row and changes nothing that's actually taken effect yet. */
export async function DELETE() {
  const { user, response } = await requireCurrentUser();
  if (!user) return response;
  await cancelEmailChangeRequest(user.id);
  return NextResponse.json({ ok: true });
}
