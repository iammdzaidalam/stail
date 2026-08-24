"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { ROLES, type Role } from "@/lib/definitions";

const ADMIN = ["HR", "FOUNDER", "SUPER_ADMIN"] as const;

export async function approveRegistration(formData: FormData): Promise<void> {
  const actor = await requireUser([...ADMIN]);
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  const teamId = String(formData.get("teamId") ?? "");

  const person = await db.user.findUnique({ where: { id } });
  if (!person || person.status !== "PENDING") {
    redirect("/admin/registrations?problem=gone");
  }
  if (!ROLES.includes(role as Role) || role === "SUPER_ADMIN") {
    redirect("/admin/registrations?problem=role");
  }

  let managerId: string | null = null;
  if (teamId) {
    const team = await db.team.findUnique({ where: { id: teamId } });
    if (!team) redirect("/admin/registrations?problem=team");
    managerId = team.leadId ?? team.managerId ?? null;
    if (managerId === person.id) managerId = null;
  }

  await db.user.update({
    where: { id: person.id },
    data: {
      status: "ACTIVE",
      role,
      teamId: teamId || null,
      managerId,
      joiningDate: new Date(),
    },
  });
  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "registration.approve",
    entity: "User",
    entityId: person.id,
    before: { status: "PENDING" },
    after: { status: "ACTIVE", role, teamId: teamId || null },
  });

  revalidatePath("/", "layout");
  redirect("/admin/registrations?done=approved");
}

export async function rejectRegistration(formData: FormData): Promise<void> {
  const actor = await requireUser([...ADMIN]);
  const id = String(formData.get("id") ?? "");

  const person = await db.user.findUnique({ where: { id } });
  if (!person || person.status !== "PENDING") {
    redirect("/admin/registrations?problem=gone");
  }

  await db.user.update({ where: { id: person.id }, data: { status: "REJECTED" } });
  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "registration.reject",
    entity: "User",
    entityId: person.id,
    before: { status: "PENDING" },
    after: { status: "REJECTED" },
  });

  revalidatePath("/", "layout");
  redirect("/admin/registrations?done=rejected");
}

/**
 * Permanently remove a PENDING or REJECTED registration, freeing the email
 * for re-registration. Never touches active or exited accounts.
 */
export async function deleteRegistration(formData: FormData): Promise<void> {
  const actor = await requireUser([...ADMIN]);
  const id = String(formData.get("id") ?? "");

  const person = await db.user.findUnique({ where: { id } });
  if (!person || (person.status !== "PENDING" && person.status !== "REJECTED")) {
    redirect("/admin/registrations?problem=gone");
  }

  await db.user.delete({ where: { id: person.id } });
  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "registration.delete",
    entity: "User",
    entityId: person.id,
    before: { email: person.email, status: person.status },
  });

  revalidatePath("/", "layout");
  redirect("/admin/registrations?done=deleted");
}
