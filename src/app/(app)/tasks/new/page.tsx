import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createTask } from "../actions";
import { assigneeGroups } from "../assignee-options";
import { TaskForm } from "../task-form";

export default async function NewTaskPage() {
  const user = await requireUser();

  const [projects, assignees] = await Promise.all([
    db.project.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    assigneeGroups(user),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="New Task"
        description={
          assignees
            ? "Create a task for yourself or someone on your teams."
            : "Create a task for yourself."
        }
      />
      <Card className="max-w-2xl">
        <TaskForm
          action={createTask}
          projects={projects}
          assignees={assignees}
          defaults={{ assigneeId: user.id, priority: "MEDIUM" }}
          submitLabel="Create task"
          cancelHref="/tasks"
        />
      </Card>
    </>
  );
}
