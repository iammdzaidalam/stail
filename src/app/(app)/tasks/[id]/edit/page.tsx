import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canViewUser, isManagerial } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { updateTask } from "../../actions";
import { assigneeGroups } from "../../assignee-options";
import { TaskForm, type ProjectOption } from "../../task-form";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const task = await db.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      dueDate: true,
      projectId: true,
      assigneeId: true,
      creatorId: true,
      assignee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, status: true } },
    },
  });
  if (!task) redirect("/tasks");

  const allowed =
    task.assigneeId === user.id ||
    task.creatorId === user.id ||
    (isManagerial(user.role) && (await canViewUser(user, task.assigneeId)));
  if (!allowed) redirect(`/tasks/${id}`);

  const [activeProjects, assignees] = await Promise.all([
    db.project.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    assigneeGroups(user, { id: task.assignee.id, name: task.assignee.name }),
  ]);

  // Keep the current project selectable even if it is no longer active.
  const projects: ProjectOption[] =
    task.project && !activeProjects.some((p) => p.id === task.project?.id)
      ? [{ id: task.project.id, name: `${task.project.name} (inactive)` }, ...activeProjects]
      : activeProjects;

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="Edit Task"
        description={task.title}
      />
      <Card className="max-w-2xl">
        <TaskForm
          action={updateTask}
          projects={projects}
          assignees={assignees}
          defaults={{
            taskId: task.id,
            title: task.title,
            description: task.description ?? undefined,
            projectId: task.projectId ?? "",
            priority: task.priority,
            dueDate: task.dueDate ?? undefined,
            assigneeId: task.assigneeId,
          }}
          submitLabel="Save changes"
          cancelHref={`/tasks/${task.id}`}
        />
      </Card>
    </>
  );
}
