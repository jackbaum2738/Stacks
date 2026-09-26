import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/api-context";
import { isValidEmailShape } from "@/lib/account-validation";
import { getPendingEmailChange } from "@/lib/email-change";

/**
 * Pre-check used by the profile page so an already-current or already-taken email is caught
 * before the re-auth (current password) step, same pattern as the username pre-check
 * (GET /api/account/username/available). The PATCH route re-checks both itself regardless,
 * since this GET is just a UX convenience, not the source of truth. Also reports whether this
 * address matches the one already pending, so the client can treat it as a plain resend (which
 * needs no password at all -- see POST /api/account/email/resend) instead of opening re-auth.
 */
export async function GET(request: NextRequest) {
  const { user, response } = await requireCurrentUser();
  if (!user) return response;

  const raw = request.nextUrl.searchParams.get("email") ?? "";
  const email = raw.trim().toLowerCase();

  if (!isValidEmailShape(email)) {
    return NextResponse.json({ available: false, error: "Enter a valid email" }, { status: 400 });
  }

  if (email === user.email.toLowerCase()) {
    return NextResponse.json({ available: false, error: "That's already your email." });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ available: false, error: "That email is already associated with a Stacks account." });
  }

  const pending = await getPendingEmailChange(user.id);
  const isResendOfPending = !!pending && pending.newEmail === email;
  return NextResponse.json({ available: true, isResendOfPending });
}
