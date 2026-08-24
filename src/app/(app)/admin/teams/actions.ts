"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const ADMIN = ["HR", "FOUNDER", "SUPER_ADMIN"] as const;

async function readTeamFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const department = String(formData.get("department") ?? "").trim().slice(0, 80);
  const leadId = String(formData.get("leadId") ?? "");
  const managerId = String(formData.get("managerId") ?? "");

  const validUser = async (id: string) =>
    id
      ? (await db.user.findFirst({ where: { id, status: "ACTIVE" }, select: { id: true } }))
          ?.id ?? null
      : null;

  return {
    name,
    department,
    leadId: await validUser(leadId),
    managerId: await validUser(managerId),
  };
}

export type TeamFormState = { error?: string; ok?: boolean };

export async function createTeam(
  _prev: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const actor = await requireUser([...ADMIN]);
  const { name, department, leadId, managerId } = await readTeamFields(formData);

  if (!name) return { error: "Give the team a name." };
  if (!department) return { error: "Which department does it belong to?" };
  const existing = await db.team.findUnique({ where: { name } });
  if (existing) return { error: "A team with this name already exists." };

  const team = await db.team.create({ data: { name, department, leadId, managerId } });
  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "team.create",
    entity: "Team",
    entityId: team.id,
    after: { name, department },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTeam(
  _prev: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  const actor = await requireUser([...ADMIN]);
  const id = String(formData.get("id") ?? "");
  const team = await db.team.findUnique({ where: { id } });
  if (!team) return { error: "Team not found." };

  const { name, department, leadId, managerId } = await readTeamFields(formData);
  if (!name) return { error: "Give the team a name." };
  if (!department) return { error: "Which department does it belong to?" };
  const clash = await db.team.findFirst({ where: { name, NOT: { id } } });
  if (clash) return { error: "Another team already uses this name." };

  const before = {
    name: team.name,
    department: team.department,
    leadId: team.leadId,
    managerId: team.managerId,
  };
  const after = { name, department, leadId, managerId };
  await db.team.update({ where: { id }, data: after });
  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "team.update",
    entity: "Team",
    entityId: id,
    before,
    after,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTeam(formData: FormData): Promise<void> {
  const actor = await requireUser([...ADMIN]);
  const id = String(formData.get("id") ?? "");
  const team = await db.team.findUnique({
    where: { id },
    include: { _count: { select: { members: true, projects: true, tasks: true } } },
  });
  if (!team) redirect("/admin/teams?problem=gone");
  if (team._count.members > 0 || team._count.projects > 0 || team._count.tasks > 0) {
    redirect("/admin/teams?problem=not-empty");
  }

  await db.team.delete({ where: { id } });
  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "team.delete",
    entity: "Team",
    entityId: id,
    before: { name: team.name, department: team.department },
  });

  revalidatePath("/", "layout");
  redirect("/admin/teams?done=deleted");
}
