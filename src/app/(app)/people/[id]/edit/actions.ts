"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isManagerial } from "@/lib/rbac";
import {
  EMPLOYMENT_TYPES,
  ROLES,
  type EmploymentType,
  type Role,
} from "@/lib/definitions";

export type UpdatePersonState = { error?: string; ok?: boolean };

export async function updatePerson(
  _prev: UpdatePersonState,
  formData: FormData,
): Promise<UpdatePersonState> {
  const actor = await requireUser(["HR", "FOUNDER"]);

  const id = String(formData.get("id") ?? "");
  const person = await db.user.findUnique({ where: { id } });
  if (!person) return { error: "Person not found." };

  const roleInput = String(formData.get("role") ?? person.role);
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const teamId = String(formData.get("teamId") ?? "");
  const managerId = String(formData.get("managerId") ?? "");
  const employmentType = String(formData.get("employmentType") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!ROLES.includes(roleInput as Role)) return { error: "Choose a valid role." };
  if (!EMPLOYMENT_TYPES.includes(employmentType as EmploymentType)) {
    return { error: "Choose a valid employment type." };
  }
  if (status !== "ACTIVE" && status !== "EXITED") {
    return { error: "Choose a valid status." };
  }

  // Founder protection: the whole founder record is only editable by the
  // founder themself, the Founder role can only be granted by a founder, and
  // nobody can change their own role.
  if (person.role === "FOUNDER" && actor.id !== person.id) {
    return { error: "The founder's profile can only be edited by the founder." };
  }
  if (roleInput === "FOUNDER" && actor.role !== "FOUNDER") {
    return { error: "Only the founder can assign the Founder role." };
  }
  if (actor.id === person.id && roleInput !== person.role) {
    return { error: "You can't change your own role." };
  }
  const role = roleInput;

  if (teamId) {
    const team = await db.team.findUnique({ where: { id: teamId } });
    if (!team) return { error: "Choose a valid team." };
  }
  if (managerId) {
    if (managerId === person.id) return { error: "A person cannot be their own manager." };
    const manager = await db.user.findUnique({ where: { id: managerId } });
    if (!manager || !isManagerial(manager.role) || manager.status !== "ACTIVE") {
      return { error: "Choose a valid manager." };
    }
  }

  const before = {
    role: person.role,
    title: person.title,
    teamId: person.teamId,
    managerId: person.managerId,
    employmentType: person.employmentType,
    status: person.status,
  };
  const after = {
    role,
    title: title || null,
    teamId: teamId || null,
    managerId: managerId || null,
    employmentType,
    status,
  };

  // Only audit the fields that actually changed.
  const changedKeys = (Object.keys(after) as (keyof typeof after)[]).filter(
    (k) => before[k] !== after[k],
  );

  await db.user.update({ where: { id: person.id }, data: after });

  if (changedKeys.length > 0) {
    await logAudit({
      actor: { id: actor.id, name: actor.name },
      action: "people.update",
      entity: "User",
      entityId: person.id,
      before: Object.fromEntries(changedKeys.map((k) => [k, before[k]])),
      after: Object.fromEntries(changedKeys.map((k) => [k, after[k]])),
    });
  }

  revalidatePath("/", "layout");
  redirect(`/people/${person.id}`);
}
