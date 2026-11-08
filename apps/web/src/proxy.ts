import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/** Pages reachable without signing in. Everything else needs a session cookie. */
const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/invite"];
/** Auth pages a signed-in user doesn't need to see again. */
const GUEST_ONLY_PATHS = ["/sign-in", "/sign-up"];

function matches(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Optimistic check only: it looks for the session cookie, not whether the session is valid.
 * Every page and action still verifies the session on the server (see server/auth/session.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && !matches(pathname, PUBLIC_PATHS)) {
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && matches(pathname, GUEST_ONLY_PATHS)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals and static files.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
