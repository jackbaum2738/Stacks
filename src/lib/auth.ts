import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "stacks_session";
const ACTIVE_LIBRARY_COOKIE = "stacks_active_library";
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

/** Current user plus their library memberships, or null if not signed in. */
export async function getCurrentUser() {
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
}

/** Marks which library a user with multiple memberships is currently working in. */
export async function setActiveLibraryCookie(libraryId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_LIBRARY_COOKIE, libraryId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** The library a signed-in user is currently working in: their chosen active one, or their first membership. */
export async function getCurrentLibrary() {
  const user = await getCurrentUser();
  if (!user || user.memberships.length === 0) return null;

  const cookieStore = await cookies();
  const activeLibraryId = cookieStore.get(ACTIVE_LIBRARY_COOKIE)?.value;
  const active = activeLibraryId ? user.memberships.find((m) => m.libraryId === activeLibraryId) : undefined;
  const membership = active ?? user.memberships[0];

  return { user, membership, library: membership.library };
}
