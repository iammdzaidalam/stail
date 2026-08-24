// GET /api/export/tasks?status=&project=
// CSV export of tasks, scoped to the viewer's teams.

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isOrg, visibleTeamIds } from "@/lib/rbac";
import { TASK_STATUSES, type TaskStatus } from "@/lib/definitions";
import { csvResponse, istDateTime, jsonError, toCsv } from "../csv";

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Not authenticated");
  if (!isOrg(user.role)) return jsonError(403, "Not authorized");

  const params = new URL(request.url).searchParams;
  const statusParam = params.get("status");
  const projectParam = params.get("project");

  if (statusParam && !TASK_STATUSES.includes(statusParam as TaskStatus)) {
    return jsonError(400, "Invalid status");
  }

  const scope = await visibleTeamIds(user);
  if (scope !== "ALL" && scope.length === 0) return jsonError(403, "Not authorized");

  const tasks = await db.task.findMany({
    where: {
      ...(statusParam ? { status: statusParam } : {}),
      ...(projectParam ? { projectId: projectParam } : {}),
      ...(scope !== "ALL"
        ? {
            OR: [
              { teamId: { in: scope } },
              { assignee: { teamId: { in: scope } } },
            ],
          }
        : {}),
    },
    include: {
      assignee: { select: { name: true } },
      project: { select: { name: true } },
      team: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const csv = toCsv(
    [
      "title",
      "assignee",
      "project",
      "team",
      "priority",
      "status",
      "dueDate",
      "completedAt",
      "createdAt",
    ],
    tasks.map((t) => [
      t.title,
      t.assignee.name,
      t.project?.name ?? "",
      t.team?.name ?? "",
      t.priority,
      t.status,
      t.dueDate ?? "",
      istDateTime(t.completedAt),
      istDateTime(t.createdAt),
    ]),
  );

  const suffix = statusParam ? `-${statusParam.toLowerCase()}` : "";
  return csvResponse(`tasks${suffix}.csv`, csv);
}
