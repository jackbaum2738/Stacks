import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionCookie } from "@/lib/auth";
import { slugify } from "@/lib/slug";

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
  if (inviteCode) {
    invitedLibrary = await prisma.library.findUnique({ where: { inviteCode }, select: { id: true } });
    if (!invitedLibrary) {
      return NextResponse.json({ error: "That invite link is no longer valid" }, { status: 404 });
    }
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
          memberships: { create: { role: "MEMBER", libraryId: invitedLibrary.id } },
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

async function uniqueSlug(libraryName: string) {
  const baseSlug = slugify(libraryName) || "library";
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.library.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
}
