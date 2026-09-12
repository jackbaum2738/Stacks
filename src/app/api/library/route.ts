import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, setActiveLibraryCookie } from "@/lib/auth";
import { requireLibraryContext } from "@/lib/api-context";
import { createLibraryForUser } from "@/lib/library";

const schema = z.object({ name: z.string().trim().min(1).max(100) });

/** Creates an additional library owned by the current user, and makes it the active one. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const library = await createLibraryForUser(user.id, parsed.data.name);
  await setActiveLibraryCookie(library.id);

  return NextResponse.json({ library }, { status: 201 });
}

const deleteSchema = z.object({ confirmName: z.string() });

/** Permanently deletes the current library (and everything in it). Owner only, requires typing the exact name. */
export async function DELETE(request: Request) {
  const { context, response } = await requireLibraryContext();
  if (!context) return response;
  if (context.membership.role !== "OWNER") {
    return NextResponse.json({ error: "Only an owner can delete this library" }, { status: 403 });
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmName !== context.library.name) {
    return NextResponse.json({ error: "Library name didn't match" }, { status: 400 });
  }

  await prisma.library.delete({ where: { id: context.library.id } });

  return NextResponse.json({ ok: true });
}
