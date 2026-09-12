import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Temporary, narrowly-scoped cleanup for test data created while verifying
// the production deploy. Deletes only the exact test library (cascades its
// shelves/copies/reservations) and the exact test user email prefix used by
// that testing — never a general-purpose delete route. Removed immediately
// after use.
export async function POST() {
  const library = await prisma.library.deleteMany({
    where: { id: "cmtyax5mn0005l604woiyiueh" },
  });
  const user = await prisma.user.deleteMany({
    where: { email: { startsWith: "api-smoke-" } },
  });
  return NextResponse.json({ librariesDeleted: library.count, usersDeleted: user.count });
}
