"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isManagerial } from "@/lib/rbac";
import {
  EMPLOYMENT_TYPES,
  ROLES,
  type EmploymentType,
  type Role,
} from "@/lib/definitions";

export type CreatePersonState = { error?: string; ok?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createPerson(
  _prev: CreatePersonState,
  formData: FormData,
): Promise<CreatePersonState> {
  const actor = await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const teamId = String(formData.get("teamId") ?? "");
  const managerId = String(formData.get("managerId") ?? "");
  const employmentType = String(formData.get("employmentType") ?? "");
  const joiningDate = String(formData.get("joiningDate") ?? "");

  if (!name) return { error: "Name is required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters." };
  if (!ROLES.includes(role as Role)) return { error: "Choose a valid role." };
  if (role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    return { error: "Only the Super Admin can create a Super Admin account." };
  }
  if (!EMPLOYMENT_TYPES.includes(employmentType as EmploymentType)) {
    return { error: "Choose a valid employment type." };
  }
  if (!DATE_RE.test(joiningDate)) return { error: "Choose a joining date." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "A person with this email already exists." };

  if (teamId) {
    const team = await db.team.findUnique({ where: { id: teamId } });
    if (!team) return { error: "Choose a valid team." };
  }
  if (managerId) {
    const manager = await db.user.findUnique({ where: { id: managerId } });
    if (!manager || !isManagerial(manager.role) || manager.status !== "ACTIVE") {
      return { error: "Choose a valid manager." };
    }
  }

  // Next employee code: STL-NNN = max existing + 1.
  const codes = await db.user.findMany({ select: { employeeCode: true } });
  const maxNum = codes.reduce((max, { employeeCode }) => {
    const m = /^STL-(\d+)$/.exec(employeeCode);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const employeeCode = `STL-${String(maxNum + 1).padStart(3, "0")}`;

  const created = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
      title: title || null,
      teamId: teamId || null,
      managerId: managerId || null,
      employmentType,
      // Noon UTC keeps the IST calendar day stable.
      joiningDate: new Date(`${joiningDate}T12:00:00Z`),
      employeeCode,
      avatarHue: Math.floor(Math.random() * 361),
      status: "ACTIVE",
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "people.create",
    entity: "User",
    entityId: created.id,
    after: {
      employeeCode,
      name,
      email,
      role,
      title: title || null,
      teamId: teamId || null,
      managerId: managerId || null,
      employmentType,
      joiningDate,
    },
  });

  revalidatePath("/", "layout");
  redirect(`/people/${created.id}`);
}
