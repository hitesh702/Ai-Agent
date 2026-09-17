import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const protectedPrefixes = ["/dashboard", "/onboarding", "/leads", "/calls", "/agents", "/knowledge", "/campaigns", "/appointments", "/analytics", "/settings", "/billing"];
const authPages = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  const isAuthPage = authPages.some((p) => pathname.startsWith(p));

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/login",
    "/register",
    "/leads",
    "/leads/:path*",
    "/calls",
    "/calls/:path*",
    "/agents",
    "/agents/:path*",
    "/knowledge",
    "/campaigns",
    "/campaigns/:path*",
    "/appointments",
    "/analytics",
    "/settings",
    "/billing",
  ],
};
