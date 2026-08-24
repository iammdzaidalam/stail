"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import {
  canViewUser,
  isAdmin,
  isManagerial,
  isOrg,
  visibleTeamIds,
} from "@/lib/rbac";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/definitions";
import { STATUS_TRANSITIONS } from "./task-flow";

export type TaskFormState = { error?: string; ok?: boolean };

const MAX_TITLE = 200;
const MAX_TEXT = 2000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

type Actor = { id: string; name: string; role: string; teamId: string | null };

/**
 * May `user` assign a task to `assigneeId`? Self is always allowed;
 * otherwise the user must be managerial and the assignee an active user
 * inside their visible teams (org roles see everyone).
 * Returns the resolved assignee (with teamId) or null when not permitted.
 */
async function resolveAssignee(
  user: Actor,
  assigneeId: string,
): Promise<{ id: string; teamId: string | null } | null> {
  if (!assigneeId || assigneeId === user.id) {
    return { id: user.id, teamId: user.teamId ?? null };
  }
  if (!isManagerial(user.role)) return null;
  const target = await db.user.findUnique({
    where: { id: assigneeId },
    select: { id: true, teamId: true, status: true },
  });
  if (!target || target.status !== "ACTIVE") return null;
  if (isOrg(user.role)) return { id: target.id, teamId: target.teamId };
  const ids = await visibleTeamIds(user);
  if (ids === "ALL") return { id: target.id, teamId: target.teamId };
  if (!target.teamId || !ids.includes(target.teamId)) return null;
  return { id: target.id, teamId: target.teamId };
}

/** Assignee, creator, or a managerial viewer who can see the assignee. */
async function canActOnTask(
  user: Actor,
  task: { assigneeId: string; creatorId: string },
): Promise<boolean> {
  if (user.id === task.assigneeId || user.id === task.creatorId) return true;
  return isManagerial(user.role) && (await canViewUser(user, task.assigneeId));
}

type ValidatedFields =
  | { error: string }
  | {
      title: string;
      description: string | null;
      priority: TaskPriority;
      dueDate: string | null;
      projectId: string | null;
    };

async function validateFields(
  formData: FormData,
  opts: { keepProjectId?: string | null },
): Promise<ValidatedFields> {
  const title = field(formData, "title");
  if (!title) return { error: "Title is required." };
  if (title.length > MAX_TITLE)
    return { error: `Title must be at most ${MAX_TITLE} characters.` };

  const description = field(formData, "description");
  if (description.length > MAX_TEXT)
    return { error: `Description must be at most ${MAX_TEXT} characters.` };

  const priority = field(formData, "priority") || "MEDIUM";
  if (!TASK_PRIORITIES.includes(priority as TaskPriority))
    return { error: "Invalid priority." };

  const dueDate = field(formData, "dueDate");
  if (dueDate && !DATE_RE.test(dueDate)) return { error: "Invalid due date." };

  const projectId = field(formData, "projectId");
  if (projectId && projectId !== opts.keepProjectId) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });
    if (!project) return { error: "Project not found." };
    if (project.status !== "ACTIVE")
      return { error: "Tasks can only be filed under active projects." };
  }

  return {
    title,
    description: description || null,
    priority: priority as TaskPriority,
    dueDate: dueDate || null,
    projectId: projectId || null,
  };
}

export async function createTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();

  const fields = await validateFields(formData, { keepProjectId: null });
  if ("error" in fields) return { error: fields.error };

  const assignee = await resolveAssignee(user, field(formData, "assigneeId"));
  if (!assignee) return { error: "You are not allowed to assign tasks to that person." };

  const task = await db.task.create({
    data: {
      title: fields.title,
      description: fields.description,
      assigneeId: assignee.id,
      creatorId: user.id,
      projectId: fields.projectId,
      teamId: assignee.teamId,
      priority: fields.priority,
      status: "TODO",
      dueDate: fields.dueDate,
    },
  });

  revalidatePath("/", "layout");
  redirect(`/tasks/${task.id}`);
}

export async function updateTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();

  const taskId = field(formData, "taskId");
  if (!taskId) return { error: "Missing task." };
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { id: true, assigneeId: true, creatorId: true, projectId: true },
  });
  if (!task) return { error: "Task not found." };
  if (!(await canActOnTask(user, task)))
    return { error: "You are not allowed to edit this task." };

  const fields = await validateFields(formData, { keepProjectId: task.projectId });
  if ("error" in fields) return { error: fields.error };

  const rawAssignee = field(formData, "assigneeId");
  let assigneeId = task.assigneeId;
  let teamId: string | null | undefined; // undefined = leave untouched
  if (rawAssignee && rawAssignee !== task.assigneeId) {
    const next = await resolveAssignee(user, rawAssignee);
    if (!next)
      return { error: "You are not allowed to assign tasks to that person." };
    assigneeId = next.id;
    teamId = next.teamId;
  }

  await db.task.update({
    where: { id: task.id },
    data: {
      title: fields.title,
      description: fields.description,
      projectId: fields.projectId,
      priority: fields.priority,
      dueDate: fields.dueDate,
      assigneeId,
      ...(teamId !== undefined ? { teamId } : {}),
    },
  });

  if (assigneeId !== task.assigneeId) {
    await logAudit({
      actor: { id: user.id, name: user.name },
      action: "task.reassign",
      entity: "Task",
      entityId: task.id,
      before: { assigneeId: task.assigneeId },
      after: { assigneeId },
    });
  }

  revalidatePath("/", "layout");
  redirect(`/tasks/${task.id}`);
}

export async function updateStatus(formData: FormData): Promise<void> {
  const user = await requireUser();

  const taskId = field(formData, "taskId");
  const status = field(formData, "status");
  if (!taskId || !TASK_STATUSES.includes(status as TaskStatus)) return;

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { id: true, status: true, assigneeId: true, creatorId: true },
  });
  if (!task) {
    // Stale UI (task deleted elsewhere) — refresh so the list shows reality.
    revalidatePath("/", "layout");
    return;
  }
  if (!(await canActOnTask(user, task))) return;

  const allowed = STATUS_TRANSITIONS[task.status as TaskStatus] ?? [];
  if (!allowed.includes(status as TaskStatus)) {
    // The status changed under the user; refresh so buttons match reality.
    revalidatePath("/", "layout");
    return;
  }

  await db.task.update({
    where: { id: task.id },
    data: {
      status,
      // Server-generated timestamp; reopening clears it.
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  revalidatePath("/", "layout");
}

export async function addComment(formData: FormData): Promise<void> {
  const user = await requireUser();

  const taskId = field(formData, "taskId");
  const body = field(formData, "body");
  if (!taskId || !body) return;
  if (body.length > MAX_TEXT) return;

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { id: true, assigneeId: true, creatorId: true },
  });
  if (!task) return;
  const hasAccess =
    task.assigneeId === user.id ||
    task.creatorId === user.id ||
    (await canViewUser(user, task.assigneeId));
  if (!hasAccess) return;

  await db.taskComment.create({
    data: { taskId: task.id, authorId: user.id, body },
  });

  revalidatePath("/", "layout");
}

export async function deleteTask(formData: FormData): Promise<void> {
  const user = await requireUser();

  const taskId = field(formData, "taskId");
  if (!taskId) return;
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      projectId: true,
      creatorId: true,
      assigneeId: true,
      assignee: {
        select: { team: { select: { leadId: true, managerId: true } } },
      },
    },
  });
  if (!task) return;

  const leadsAssigneeTeam =
    isManagerial(user.role) &&
    (task.assignee.team?.leadId === user.id ||
      task.assignee.team?.managerId === user.id);
  const allowed =
    task.creatorId === user.id || isAdmin(user.role) || leadsAssigneeTeam;
  if (!allowed) return;

  await db.task.delete({ where: { id: task.id } });

  await logAudit({
    actor: { id: user.id, name: user.name },
    action: "task.delete",
    entity: "Task",
    entityId: task.id,
    before: {
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      projectId: task.projectId,
      assigneeId: task.assigneeId,
      creatorId: task.creatorId,
    },
  });

  revalidatePath("/", "layout");
  redirect("/tasks");
}
