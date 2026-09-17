import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/api-context";
import { isValidUsername, normalizeUsername } from "@/lib/account-validation";

// Pre-check used by the profile page so a taken username is caught before the re-auth
// (current password) step, per Jack's request -- the PATCH route re-checks uniqueness
// itself regardless, since this GET is just a UX convenience, not the source of truth.
export async function GET(request: NextRequest) {
  const { user, response } = await requireCurrentUser();
  if (!user) return response;

  const raw = request.nextUrl.searchParams.get("username") ?? "";
  if (!isValidUsername(raw)) {
    return NextResponse.json(
      { available: false, error: "Username must be 3-32 characters: letters, numbers, underscores, or hyphens" },
      { status: 400 }
    );
  }
  const username = normalizeUsername(raw);

  const existing = await prisma.user.findUnique({ where: { username } });
  const available = !existing || existing.id === user.id;
  return NextResponse.json({ available, error: available ? undefined : "That username is already taken." });
}
