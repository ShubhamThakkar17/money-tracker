import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const ok = await isValidSession(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname === "/login";
  if (!ok && !isLogin) {
    const url = new URL("/login", request.url);
    if (request.nextUrl.pathname !== "/") url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (ok && isLogin && process.env.APP_PASSWORD) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
