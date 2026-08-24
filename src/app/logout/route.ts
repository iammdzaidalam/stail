import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-shared";

/**
 * Clears the session cookie and lands on /login. Used when a syntactically
 * valid session token no longer maps to an active user (deleted/reseeded/
 * exited) — a plain redirect to /login would loop, because the proxy bounces
 * valid-token holders away from /login.
 */
export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
