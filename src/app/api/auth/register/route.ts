import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionCookie } from "@/lib/auth";
import { uniqueSlug } from "@/lib/library";
import { findLibraryByInviteCode } from "@/lib/invite-code";
import type { InvitableRole } from "@/lib/permissions";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(200),
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  let invitedLibrary: { id: string } | null = null;
  let invitedRole: InvitableRole | null = null;
  if (inviteCode) {
    const found = await findLibraryByInviteCode(inviteCode);
    if (!found) {
      return NextResponse.json({ error: "This link is no longer valid — contact the library owner to request a new one." }, { status: 404 });
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
          email,
          passwordHash,
          memberships: { create: { role: invitedRole!, libraryId: invitedLibrary.id } },
        },
      })
    : await prisma.user.create({
        data: {
          name,
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
