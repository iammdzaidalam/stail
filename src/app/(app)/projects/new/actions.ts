"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

export type ProjectFormState = { error?: string };

const CODE_RE = /^[A-Z0-9]{2,6}$/;

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const actor = await requireUser(["MANAGER", "HR", "FOUNDER", "SUPER_ADMIN"]);

  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  const teamId = String(formData.get("teamId") ?? "");
  const hue = Number.parseInt(String(formData.get("hue") ?? ""), 10);

  if (!name) return { error: "Give the project a name." };
  if (!CODE_RE.test(code))
    return { error: "Code must be 2–6 uppercase letters or digits (e.g. RNK)." };
  if (!Number.isInteger(hue) || hue < 0 || hue > 360)
    return { error: "Pick a color." };
  if (teamId) {
    const team = await db.team.findUnique({ where: { id: teamId } });
    if (!team) return { error: "That team no longer exists." };
  }
  if (await db.project.findUnique({ where: { name } }))
    return { error: "A project with this name already exists." };
  if (await db.project.findUnique({ where: { code } }))
    return { error: "This code is already taken." };

  const project = await db.project.create({
    data: {
      name,
      code,
      description: description || null,
      teamId: teamId || null,
      hue,
      status: "ACTIVE",
    },
  });
  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: "project.create",
    entity: "Project",
    entityId: project.id,
    after: { name, code, teamId: teamId || null },
  });

  revalidatePath("/", "layout");
  redirect(`/projects/${project.id}`);
}

/** Toggle a project between ACTIVE and ARCHIVED. */
export async function toggleProjectStatus(formData: FormData): Promise<void> {
  const actor = await requireUser(["MANAGER", "HR", "FOUNDER", "SUPER_ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return;

  const status = project.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";
  await db.project.update({ where: { id }, data: { status } });
  await logAudit({
    actor: { id: actor.id, name: actor.name },
    action: status === "ARCHIVED" ? "project.archive" : "project.reactivate",
    entity: "Project",
    entityId: id,
    before: { status: project.status },
    after: { status },
  });

  revalidatePath("/", "layout");
}
