import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/api-context";
import { verifyPassword } from "@/lib/auth";
import { isValidUsername, normalizeUsername } from "@/lib/account-validation";

const schema = z.object({
  username: z.string().trim().min(1).max(32).refine(isValidUsername, {
    message: "Username must be 3-32 characters: letters, numbers, underscores, or hyphens",
  }),
  currentPassword: z.string().min(1),
});

export async function PATCH(request: Request) {
  const { user, response } = await requireCurrentUser();
  if (!user) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const username = normalizeUsername(parsed.data.username);

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "That password isn't right" }, { status: 401 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { username },
  });

  return NextResponse.json({ username: updated.username });
}
