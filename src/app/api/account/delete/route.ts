import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/api-context";
import { verifyPassword, clearSessionCookie } from "@/lib/auth";

const schema = z.object({
  confirmUsername: z.string(),
  currentPassword: z.string().min(1),
});

/**
 * Permanently deletes the signed-in user's account. A library where they're the sole member
 * is deleted along with them (Library's own cascades already clear its shelves, copies,
 * reservations, etc. -- see DELETE /api/library); a library they share with others just loses
 * their Membership row, which happens for free when the User row cascades. A library where
 * they're Owner *and* others remain is a hard block -- Membership.role has no "no owner" state,
 * so ownership must be transferred (existing /api/library/transfer-ownership flow) before the
 * account can go. Re-checked here even though the client already disables the button for this,
 * same defense-in-depth as the confirmUsername/currentPassword checks below.
 */
export async function DELETE(request: Request) {
  const { user, response } = await requireCurrentUser();
  if (!user) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  if (parsed.data.confirmUsername !== user.username) {
    return NextResponse.json({ error: "Username didn't match" }, { status: 400 });
  }

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "That password isn't right" }, { status: 401 });
  }

  const libraryIds = user.memberships.map((m) => m.libraryId);
  const counts = libraryIds.length
    ? await prisma.membership.groupBy({
        by: ["libraryId"],
        where: { libraryId: { in: libraryIds } },
        _count: { _all: true },
      })
    : [];
  const memberCountByLibrary = new Map(counts.map((c) => [c.libraryId, c._count._all]));

  const blocking = user.memberships.filter(
    (m) => m.role === "OWNER" && (memberCountByLibrary.get(m.libraryId) ?? 1) > 1
  );
  if (blocking.length > 0) {
    return NextResponse.json(
      {
        error: "Transfer ownership before deleting your account",
        blockingLibraries: blocking.map((m) => m.library.name),
      },
      { status: 409 }
    );
  }

  const soleLibraryIds = user.memberships
    .filter((m) => (memberCountByLibrary.get(m.libraryId) ?? 1) === 1)
    .map((m) => m.libraryId);

  await prisma.$transaction([
    ...soleLibraryIds.map((id) => prisma.library.delete({ where: { id } })),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
