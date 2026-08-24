"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/definitions";
import type { TaskFormState } from "./actions";
import type { AssigneeGroup } from "./assignee-options";

export type ProjectOption = { id: string; name: string };

export function TaskForm({
  action,
  projects,
  assignees,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: (prev: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  projects: ProjectOption[];
  /** null = no assignee field; the server self-assigns. */
  assignees: AssigneeGroup[] | null;
  defaults?: {
    taskId?: string;
    title?: string;
    description?: string;
    projectId?: string;
    priority?: string;
    dueDate?: string;
    assigneeId?: string;
  };
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<TaskFormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {defaults?.taskId && (
        <input type="hidden" name="taskId" value={defaults.taskId} />
      )}

      <Field label="Title" htmlFor="task-title">
        <Input
          id="task-title"
          name="title"
          required
          maxLength={200}
          defaultValue={defaults?.title}
          placeholder="What needs to be done?"
          autoComplete="off"
        />
      </Field>

      <Field
        label="Description"
        htmlFor="task-description"
        hint="Optional — context, links, acceptance criteria."
      >
        <Textarea
          id="task-description"
          name="description"
          maxLength={2000}
          defaultValue={defaults?.description}
          placeholder="Add details…"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Project" htmlFor="task-project">
          <Select
            id="task-project"
            name="projectId"
            defaultValue={defaults?.projectId ?? ""}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Priority" htmlFor="task-priority">
          <Select
            id="task-priority"
            name="priority"
            defaultValue={defaults?.priority ?? "MEDIUM"}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Due date" htmlFor="task-due">
          <Input
            id="task-due"
            name="dueDate"
            type="date"
            defaultValue={defaults?.dueDate}
          />
        </Field>

        {assignees && (
          <Field label="Assignee" htmlFor="task-assignee">
            <Select
              id="task-assignee"
              name="assigneeId"
              defaultValue={defaults?.assigneeId}
            >
              {assignees.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {state.error && <p className="text-sm text-bad">{state.error}</p>}

      <div className="flex items-center gap-2.5 pt-1">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonClass({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
