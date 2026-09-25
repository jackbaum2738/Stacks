import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLibraryContext } from "@/lib/api-context";

/** Cancels an open invite. Admin+ only. Deleting the row is what makes the link show as
 * "no longer valid" if the invitee clicks it later -- see LibraryInvite's schema comment. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/[libraryCode]/invites/[id]">) {
  const { libraryCode, id } = await ctx.params;
  const { context, response } = await requireLibraryContext(libraryCode, { require: "manage" });
  if (!context) return response;
  const invite = await prisma.libraryInvite.findFirst({ where: { id, libraryId: context.library.id } });
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

  await prisma.libraryInvite.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
