import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createLibraryForUser } from "@/lib/library";

const schema = z.object({ name: z.string().trim().min(1).max(100) });

/**
 * Creates an additional library owned by the current user. Not library-scoped (there's no
 * code to resolve yet), unlike every other library route -- see /api/[libraryCode]/route.ts
 * for the DELETE that used to live here.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const library = await createLibraryForUser(user.id, parsed.data.name);

  return NextResponse.json({ library }, { status: 201 });
}
