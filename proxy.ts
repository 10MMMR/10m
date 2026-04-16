import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ALLOWED_EXACT_PATHS = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isAllowedPath(pathname: string) {
  if (pathname === "/waitlist" || pathname.startsWith("/waitlist/")) {
    return true;
  }

  if (pathname.startsWith("/_next/")) {
    return true;
  }

  if (ALLOWED_EXACT_PATHS.has(pathname)) {
    return true;
  }

  // Allow public/static file requests (e.g. images, fonts) to avoid breaking page assets.
  if (pathname.includes(".")) {
    return true;
  }

  return false;
}

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/waitlist", request.url));
  }

  if (isAllowedPath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/waitlist", request.url));
}

export const config = {
  matcher: ["/:path*"],
};
