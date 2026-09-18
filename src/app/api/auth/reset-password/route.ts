import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { isPasswordValid } from "@/lib/account-validation";
import { consumePasswordResetToken } from "@/lib/password-reset";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().refine(isPasswordValid, {
    message: "Password must be at least 8 characters and include a number and a special character",
  }),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const user = await consumePasswordResetToken(parsed.data.token);
  if (!user) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
