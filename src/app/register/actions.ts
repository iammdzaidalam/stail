"use server";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type RegisterState = {
  error?: string;
  ok?: boolean;
  values?: { name?: string; email?: string; title?: string; phone?: string };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public self-registration. Creates a PENDING account that cannot log in
 * until an admin (HR / Founder / Super Admin) approves it and assigns a role
 * and team.
 */
export async function register(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 20);
  const values = { name, email, title, phone };

  if (!name) return { error: "Enter your full name.", values };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address.", values };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters.", values };
  if (password.length > 100) return { error: "Password is too long.", values };
  if (password !== confirm) return { error: "Passwords don't match.", values };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.status === "PENDING")
      return {
        error: "This email already has a registration awaiting approval.",
        values,
      };
    if (existing.status === "REJECTED")
      return {
        error: "This registration was declined. Contact People Ops to reapply.",
        values,
      };
    return { error: "This email is already registered — log in instead.", values };
  }

  const codes = await db.user.findMany({ select: { employeeCode: true } });
  const maxNum = codes.reduce((max, { employeeCode }) => {
    const m = /^STL-(\d+)$/.exec(employeeCode);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);

  const created = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      phone: phone || null,
      title: title || null,
      role: "EMPLOYEE",
      employmentType: "FULL_TIME",
      status: "PENDING",
      joiningDate: new Date(),
      employeeCode: `STL-${String(maxNum + 1).padStart(3, "0")}`,
      avatarHue: Math.floor(Math.random() * 360),
    },
  });

  await logAudit({
    actor: { id: created.id, name: created.name },
    action: "registration.submit",
    entity: "User",
    entityId: created.id,
    after: { email, status: "PENDING" },
  });

  return { ok: true };
}
