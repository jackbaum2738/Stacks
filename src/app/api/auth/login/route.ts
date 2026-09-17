import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionCookie } from "@/lib/auth";

const schema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const identifier = parsed.data.identifier.toLowerCase();
  const { password } = parsed.data;

  // The sign-in field accepts either an email or a username -- both are stored lowercased,
  // so a single lowercased lookup against either column covers both.
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect email/username or password" }, { status: 401 });
  }

  await createSessionCookie(user.id);

  return NextResponse.json({ ok: true });
}
