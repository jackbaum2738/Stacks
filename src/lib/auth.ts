import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "stacks_session";
/**
 * Purely a convenience hint for where to send a signed-in user from an entry point that
 * doesn't itself name a library (the /dashboard lobby, a header logo link) -- stores the
 * library's CODE, never used for authorization. Every actual library page/route resolves
 * access from the code in its own URL (see getLibraryByCode below), not from any cookie, so
 * two tabs open on two different library codes can never cross-contaminate -- at worst a
 * stale/tampered hint here sends someone to the wrong (but still their own) library.
 */
export const LAST_LIBRARY_COOKIE = "stacks_last_library";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set to a long random string");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionCookie(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

/**
 * Current user plus their library memberships, or null if not signed in. Wrapped in React's
 * `cache()` since a page and its layout(s) often both need this on every request -- dedupes
 * to one query per request.
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { library: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
});

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Resolves the library named by a URL's "L-XXXXXX" code, checked against the signed-in
 * user's own memberships. This -- not a cookie -- is what every /{code}/... page and
 * /api/{code}/... route authorizes against, which is what makes it safe to have two
 * different libraries open in two different tabs at once: each request's access comes
 * entirely from the code in its own URL, never from session-wide state a sibling tab could
 * have changed underneath it.
 */
export async function getLibraryByCode(code: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "unauthenticated" as const, user: null, membership: null, library: null };
  }

  const membership = user.memberships.find((m) => m.library.code === code);
  if (!membership) {
    return { status: "forbidden" as const, user, membership: null, library: null };
  }

  return { status: "ok" as const, user, membership, library: membership.library };
}

/**
 * Which library code to send a signed-in user to from an entry point that doesn't name one
 * (the /dashboard lobby, the header logo) -- the last one they visited (LAST_LIBRARY_COOKIE),
 * falling back to their first membership. Returns null only if they have no memberships at
 * all. Never used for authorization -- see getLibraryByCode.
 */
export async function getDefaultLibraryCode(user: CurrentUser): Promise<string | null> {
  if (user.memberships.length === 0) return null;

  const cookieStore = await cookies();
  const hint = cookieStore.get(LAST_LIBRARY_COOKIE)?.value;
  const hinted = hint ? user.memberships.find((m) => m.library.code === hint) : undefined;

  return (hinted ?? user.memberships[0]).library.code;
}

/**
 * Sets the LAST_LIBRARY_COOKIE hint from server-side code that isn't proxy.ts itself (e.g.
 * accepting an invite lands the new member somewhere they haven't visited via the URL yet,
 * so there's no request path for proxy.ts to read the code from).
 */
export async function setLastLibraryCookie(code: string) {
  const cookieStore = await cookies();
  cookieStore.set(LAST_LIBRARY_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}
