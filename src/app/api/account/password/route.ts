import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/api-context";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { isPasswordValid } from "@/lib/account-validation";

const schema = z.object({
  newPassword: z.string().refine(isPasswordValid, {
    message: "Password must be at least 8 characters and include a number and a special character",
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

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "That password isn't right" }, { status: 401 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
