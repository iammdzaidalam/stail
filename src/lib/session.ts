import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import type { Role } from "./definitions";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  signSession,
  verifySession,
} from "./session-shared";

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>;

async function loadUser(id: string) {
  return db.user.findUnique({
    where: { id },
    include: { team: true },
  });
}

export async function createSession(user: {
  id: string;
  role: string;
  name: string;
}): Promise<void> {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * The logged-in user with their team, fresh from the DB (role/status changes
 * apply immediately). Null when unauthenticated, invalid, or deactivated.
 * Cached per request.
 */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await loadUser(payload.sub);
  if (!user || user.status !== "ACTIVE") return null;
  return user;
});

/**
 * Require an authenticated user; optionally restrict to specific roles.
 * Redirects to /login when unauthenticated and /dashboard when unauthorized.
 * A stale-but-valid token (user deleted or deactivated) goes through /logout
 * so the cookie is cleared instead of looping against the proxy.
 * Use in pages and server actions.
 */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const store = await cookies();
    redirect(store.get(SESSION_COOKIE) ? "/logout" : "/login");
  }
  if (roles && !roles.includes(user.role as Role)) redirect("/dashboard");
  return user;
}
