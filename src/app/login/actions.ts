"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  clearLoginFailures,
  loginThrottled,
  recordLoginFailure,
  verifyPassword,
} from "@/lib/auth";
import { createSession, destroySession, getCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };
  if (loginThrottled(email))
    return { error: "Too many attempts. Try again in a few minutes." };

  const generic = "Invalid email or password.";
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    recordLoginFailure(email);
    return { error: generic };
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    recordLoginFailure(email);
    return { error: generic };
  }
  // Only after the password checks out do we reveal account state.
  if (user.status === "PENDING") {
    return {
      error: "Your registration is still awaiting admin approval.",
    };
  }
  if (user.status === "REJECTED") {
    return {
      error: "Your registration was declined. Contact People Ops for help.",
    };
  }
  if (user.status !== "ACTIVE") {
    recordLoginFailure(email);
    return { error: generic };
  }

  clearLoginFailures(email);
  await createSession(user);
  await logAudit({
    actor: { id: user.id, name: user.name },
    action: "auth.login",
    entity: "User",
    entityId: user.id,
  });
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await logAudit({
      actor: { id: user.id, name: user.name },
      action: "auth.logout",
      entity: "User",
      entityId: user.id,
    });
  }
  await destroySession();
  redirect("/login");
}
