import { NextResponse } from "next/server";
import { getCurrentLibrary } from "@/lib/auth";

type LibraryContext = NonNullable<Awaited<ReturnType<typeof getCurrentLibrary>>>;

/** Resolves the signed-in user's active library for an API route, or returns a 401 response. */
export async function requireLibraryContext(): Promise<
  { context: LibraryContext; response: null } | { context: null; response: NextResponse }
> {
  const context = await getCurrentLibrary();
  if (!context) {
    return { context: null, response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  return { context, response: null };
}
