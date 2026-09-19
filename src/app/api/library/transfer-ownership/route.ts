import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

const schema = z.object({ membershipId: z.string().trim().min(1) });

/**
 * Hands ownership to another member: they become Owner, the current Owner becomes Admin.
 * Owner only -- this is the only way anyone (including the Owner themselves) stops being
 * Owner, since a Membership.role of OWNER can't otherwise be removed or changed (see
 * members/[id]/route.ts). An Owner who wants to leave the library entirely transfers
 * first, then removes their own (now Admin) membership like anyone else.
 *
 * The target must already be an Admin -- the Settings members UI only ever offers "Make
 * owner" on Admin rows, and this is enforced here too rather than just hidden in the UI,
 * matching how the Owner-row protections elsewhere in this file are enforced server-side.
 */
export async function POST(request: Request) {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;
  if (context.membership.role !== "OWNER") {
    return NextResponse.json({ error: "Only the current owner can transfer ownership" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const target = await prisma.membership.findFirst({
    where: { id: parsed.data.membershipId, libraryId: context.library.id },
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.id === context.membership.id) {
    return NextResponse.json({ error: "You're already the owner" }, { status: 409 });
  }
  if (target.role !== "ADMIN") {
    return NextResponse.json({ error: "Only an Admin can be made owner -- promote them to Admin first" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.membership.update({ where: { id: target.id }, data: { role: "OWNER" } }),
    prisma.membership.update({ where: { id: context.membership.id }, data: { role: "ADMIN" } }),
  ]);

  return NextResponse.json({ ok: true });
}
