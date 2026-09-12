import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Temporary, narrowly-scoped cleanup for test data created while verifying
// the invite-link deploy. Deletes only the exact test library (cascades its
// shelves/copies/memberships/reservations) and the exact test user email
// prefixes used by that testing — never a general-purpose delete route.
// Removed immediately after use.
export async function POST() {
  const library = await prisma.library.deleteMany({
    where: { name: "Prod Invite Test Library" },
  });
  const users = await prisma.user.deleteMany({
    where: { email: { startsWith: "prod-invite-test-" } },
  });
  return NextResponse.json({ librariesDeleted: library.count, usersDeleted: users.count });
}
