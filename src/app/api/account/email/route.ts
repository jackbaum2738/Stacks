import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/api-context";
import { verifyPassword } from "@/lib/auth";
import { isValidEmailShape } from "@/lib/account-validation";

const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidEmailShape, { message: "Enter a valid email" }),
  currentPassword: z.string().min(1),
});

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { email },
  });

  return NextResponse.json({ email: updated.email });
}
