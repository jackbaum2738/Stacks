import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendTransactionalEmail } from "@/lib/brevo";
import { buildPasswordResetEmail } from "@/lib/emails/password-reset";

const schema = z.object({
  identifier: z.string().trim().min(1),
});

const GENERIC_RESPONSE = { ok: true, message: "If that account exists, we've sent a password reset link to it." };

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const identifier = parsed.data.identifier.toLowerCase();

  // Same lookup as login: either an email or a username, both stored lowercased. Always
  // return the same generic response either way, so this can't be used to test which emails
  // or usernames have an account.
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });

  if (user) {
    const origin = new URL(request.url).origin;
    const token = await createPasswordResetToken(user.id);
    const resetUrl = `${origin}/reset-password?token=${token}`;
    const email = buildPasswordResetEmail({ username: user.username, resetUrl, origin });
    await sendTransactionalEmail({
      to: { email: user.email, name: user.name ?? undefined },
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
