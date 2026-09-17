import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionCookie } from "@/lib/auth";
import { uniqueSlug } from "@/lib/library";
import { findLibraryByInviteCode } from "@/lib/invite-code";
import { isPasswordValid, isValidEmailShape, isValidUsername, normalizeUsername } from "@/lib/account-validation";
import type { InvitableRole } from "@/lib/permissions";

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
  libraryName: z.string().trim().max(100).optional(),
  inviteCode: z.string().trim().min(1).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, email, password, libraryName, inviteCode } = parsed.data;
  const username = normalizeUsername(parsed.data.username);

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  let invitedLibrary: { id: string } | null = null;
  let invitedRole: InvitableRole | null = null;
  if (inviteCode) {
    const found = await findLibraryByInviteCode(inviteCode);
    if (!found) {
      return NextResponse.json({ error: "That invite link is no longer valid" }, { status: 404 });
    }
    invitedLibrary = { id: found.library.id };
    invitedRole = found.role;
  } else if (!libraryName) {
    return NextResponse.json({ error: "Library name is required" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const user = invitedLibrary
    ? await prisma.user.create({
        data: {
          name,
          username,
          email,
          passwordHash,
          memberships: { create: { role: invitedRole!, libraryId: invitedLibrary.id } },
        },
      })
    : await prisma.user.create({
        data: {
          name,
          username,
          email,
          passwordHash,
          memberships: {
            create: {
              role: "OWNER",
              library: {
                create: {
                  name: libraryName!,
                  slug: await uniqueSlug(libraryName!),
                  shelves: { create: [{ name: "Unsorted" }] },
                },
              },
            },
          },
        },
      });

  await createSessionCookie(user.id);

  return NextResponse.json({ ok: true });
}
