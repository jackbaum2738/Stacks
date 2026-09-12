import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, setActiveLibraryCookie } from "@/lib/auth";

const schema = z.object({ libraryId: z.string().trim().min(1) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const isMember = user.memberships.some((m) => m.libraryId === parsed.data.libraryId);
  if (!isMember) return NextResponse.json({ error: "Not a member of that library" }, { status: 403 });

  await setActiveLibraryCookie(parsed.data.libraryId);
  return NextResponse.json({ ok: true });
}
