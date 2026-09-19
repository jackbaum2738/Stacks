import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionCookie } from "@/lib/auth";
import { isPasswordValid, isValidEmailShape, isValidUsername, normalizeUsername } from "@/lib/account-validation";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  username: z.string().trim().min(1).max(32).refine(isValidUsername, {
    message: "Username must be 3-32 characters: letters, numbers, underscores, or hyphens",
  }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidEmailShape, { message: "Enter a valid email" }),
  password: z.string().refine(isPasswordValid, {
    message: "Password must be at least 8 characters and include a number and a special character",
  }),
  inviteCode: z.string().trim().min(1).optional(),
});

/**
 * Sign-up only ever collects account details now -- no library name here, and every account
 * (invited or not) is created with zero memberships. A non-invite signup is gated by the
 * dashboard's CreateFirstLibraryModal until a library exists; an invite signup instead confirms
 * the invite token is still live and leaves the actual join to InviteAcceptOverlay after
 * sign-in, same as an already-registered user accepting the same link.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, email, password, inviteCode } = parsed.data;
  const username = normalizeUsername(parsed.data.username);

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  if (inviteCode) {
    // Just confirm the invite is still live -- the actual join happens as its own confirmation
    // step after sign-in, via InviteAcceptOverlay, same as an existing account accepting the
    // same link. This account is created library-less on purpose (see the dashboard layout's
    // zero-membership branch), not auto-joined here.
    const invite = await prisma.libraryInvite.findUnique({ where: { token: inviteCode } });
    if (!invite) {
      return NextResponse.json({ error: "This link is no longer valid — contact the library owner to request a new one." }, { status: 404 });
    }
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({ data: { name, username, email, passwordHash } });

  await createSessionCookie(user.id);

  return NextResponse.json({ ok: true });
}
