import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-shared";

const PUBLIC_PATHS = new Set(["/login"]);

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (PUBLIC_PATHS.has(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", req.url);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets
    "/((?!_next|brand|api|.*\\.(?:png|svg|ico|jpg|jpeg|webp|txt|xml)$).*)",
  ],
};
