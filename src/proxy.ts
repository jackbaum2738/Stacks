import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "stacks_session";
// Same cookie name/shape as LAST_LIBRARY_COOKIE in src/lib/auth.ts -- duplicated here rather
// than imported since proxy.ts runs in the Edge-adjacent Node.js middleware runtime, kept
// dependency-free of the rest of the app on purpose.
const LAST_LIBRARY_COOKIE = "stacks_last_library";
const LIBRARY_CODE_PATTERN = /^L-[A-Z2-9]{6}$/;

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = await hasValidSession(request);

  const firstSegment = pathname.split("/")[1] ?? "";
  const libraryCode = LIBRARY_CODE_PATTERN.test(firstSegment) ? firstSegment : null;
  const isProtectedPage = pathname.startsWith("/dashboard") || libraryCode !== null;

  if (isProtectedPage && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/register") && authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();

  // Remember the last library code visited, purely as a convenience default for the
  // /dashboard lobby's next redirect -- never used for authorization (see LAST_LIBRARY_COOKIE
  // in src/lib/auth.ts), so this is safe to set unconditionally for any authed request that
  // reaches a library URL, regardless of whether that library turns out to be theirs.
  if (libraryCode && authed) {
    response.cookies.set(LAST_LIBRARY_COOKIE, libraryCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/:code(L-[A-Z0-9]+)/:path*", "/login", "/register"],
};
