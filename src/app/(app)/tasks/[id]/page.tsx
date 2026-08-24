import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, MessageSquare, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canViewUser, isAdmin, isManagerial } from "@/lib/rbac";
import { dateKey, fmtDateFull, fmtTime, timeAgo, todayIST } from "@/lib/time";
import { cn, plural } from "@/lib/utils";
import type { TaskStatus } from "@/lib/definitions";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { addComment, deleteTask, updateStatus } from "../actions";
import { DISPLAY_TRANSITIONS, transitionLabel } from "../task-flow";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      assignee: {
        select: {
          id: true,
          name: true,
          avatarHue: true,
          team: { select: { id: true, name: true, leadId: true, managerId: true } },
        },
      },
      creator: { select: { id: true, name: true, avatarHue: true } },
      project: { select: { id: true, name: true, hue: true } },
      team: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, avatarHue: true } } },
      },
    },
  });
  if (!task) redirect("/tasks");

  const canView =
    task.assigneeId === user.id ||
    task.creatorId === user.id ||
    (await canViewUser(user, task.assigneeId));
  if (!canView) redirect("/tasks");

  const canAct =
    task.assigneeId === user.id ||
    task.creatorId === user.id ||
    (isManagerial(user.role) && (await canViewUser(user, task.assigneeId)));
  const canDelete =
    task.creatorId === user.id ||
    isAdmin(user.role) ||
    (isManagerial(user.role) &&
      (task.assignee.team?.leadId === user.id ||
        task.assignee.team?.managerId === user.id));

  const today = todayIST();
  const isOverdue =
    task.dueDate != null && task.dueDate < today && task.status !== "COMPLETED";
  const confirmingDelete = sp.confirm === "delete";
  const transitions = DISPLAY_TRANSITIONS[task.status as TaskStatus] ?? [];
  const teamName = task.team?.name ?? task.assignee.team?.name;

  return (
    <>
      <Link
        href="/tasks"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint transition hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Back to tasks
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------- Left: hero + comments ---------- */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <PanelCard className="p-7 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-60">
                {task.project ? task.project.name : "Task"}
              </p>
              {canAct && (
                <Link
                  href={`/tasks/${task.id}/edit`}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-panel-line px-3.5 text-xs font-medium text-panel-ink transition hover:bg-panel-ink/10"
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Link>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight md:text-[28px]">
              {task.title}
            </h1>
            {task.description ? (
              <p className="mt-4 max-w-prose whitespace-pre-wrap text-sm leading-relaxed opacity-70">
                {task.description}
              </p>
            ) : (
              <p className="mt-4 text-sm italic opacity-40">No description provided.</p>
            )}
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-panel-line pt-4 text-xs opacity-60">
              <span>Created {timeAgo(task.createdAt)}</span>
              <span>{plural(task.comments.length, "comment")}</span>
              {task.dueDate && (
                <span>
                  Due {fmtDateFull(task.dueDate)}
                  {isOverdue ? " · overdue" : ""}
                </span>
              )}
            </div>
          </PanelCard>

          <Card>
            <SectionTitle
              title={
                <>
                  Comments{" "}
                  <span className="text-ink-faint">{task.comments.length}</span>
                </>
              }
            />
            {task.comments.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="size-5" />}
                title="No comments yet"
                hint="Notes, blockers, and updates land here."
                className="py-8"
              />
            ) : (
              <div className="flex flex-col gap-5">
                {task.comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={c.author.name} hue={c.author.avatarHue} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium tracking-tight">
                          {c.author.name}
                        </span>
                        <span className="ml-2 text-xs text-ink-faint">
                          {timeAgo(c.createdAt)}
                        </span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                        {c.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form
              action={addComment}
              className="mt-6 flex flex-col gap-3 border-t border-line pt-5"
            >
              <input type="hidden" name="taskId" value={task.id} />
              <Textarea
                name="body"
                required
                maxLength={2000}
                placeholder="Write a comment…"
                className="min-h-20"
              />
              <div>
                <Button type="submit" size="sm">
                  Comment
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* ---------- Right: meta, status, danger ---------- */}
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <CardLabel className="mb-1">Details</CardLabel>
            <div className="flex flex-col divide-y divide-line">
              <MetaRow label="Assignee">
                <span className="flex items-center gap-2">
                  <Avatar
                    name={task.assignee.name}
                    hue={task.assignee.avatarHue}
                    size="xs"
                  />
                  <span className="text-sm font-medium tracking-tight">
                    {task.assignee.name}
                  </span>
                </span>
              </MetaRow>
              <MetaRow label="Creator">
                <span className="flex items-center gap-2">
                  <Avatar
                    name={task.creator.name}
                    hue={task.creator.avatarHue}
                    size="xs"
                  />
                  <span className="text-sm text-ink-soft">{task.creator.name}</span>
                </span>
              </MetaRow>
              <MetaRow label="Project">
                {task.project ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: `hsl(${task.project.hue} 65% 55%)` }}
                    />
                    <span className="text-sm text-ink-soft">{task.project.name}</span>
                  </span>
                ) : (
                  <span className="text-sm text-ink-faint">—</span>
                )}
              </MetaRow>
              <MetaRow label="Team">
                <span className="text-sm text-ink-soft">{teamName ?? "—"}</span>
              </MetaRow>
              <MetaRow label="Priority">
                <StatusBadge status={task.priority} />
              </MetaRow>
              <MetaRow label="Status">
                <StatusBadge status={task.status} />
              </MetaRow>
              <MetaRow label="Due date">
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    isOverdue ? "font-medium text-bad" : "text-ink-soft",
                  )}
                >
                  {task.dueDate ? fmtDateFull(task.dueDate) : "—"}
                  {isOverdue && " · overdue"}
                </span>
              </MetaRow>
              <MetaRow label="Created">
                <span className="text-sm tabular-nums text-ink-soft">
                  {fmtDateFull(dateKey(task.createdAt))}
                </span>
              </MetaRow>
              {task.completedAt && (
                <MetaRow label="Completed">
                  <span className="text-sm tabular-nums text-ink-soft">
                    {fmtDateFull(dateKey(task.completedAt))} ·{" "}
                    {fmtTime(task.completedAt)}
                  </span>
                </MetaRow>
              )}
            </div>
          </Card>

          {canAct && transitions.length > 0 && (
            <Card className="p-5">
              <CardLabel className="mb-3">Move status</CardLabel>
              <div className="flex flex-wrap gap-2">
                {transitions.map((to) => (
                  <form key={to} action={updateStatus}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="status" value={to} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={to === "COMPLETED" ? "accent" : "outline"}
                    >
                      {transitionLabel(task.status as TaskStatus, to)}
                    </Button>
                  </form>
                ))}
              </div>
            </Card>
          )}

          {canDelete && (
            <Card className="border-bad/25 p-5">
              <CardLabel className="mb-2 text-bad">Danger zone</CardLabel>
              {confirmingDelete ? (
                <>
                  <p className="text-sm text-ink-soft">
                    Delete “{task.title}” and{" "}
                    {plural(task.comments.length, "comment")} permanently? This
                    cannot be undone.
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <form action={deleteTask}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <Button type="submit" size="sm" variant="danger">
                        Delete task
                      </Button>
                    </form>
                    <Link
                      href={`/tasks/${task.id}`}
                      className={buttonClass({ variant: "ghost", size: "sm" })}
                    >
                      Cancel
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-ink-soft">
                    Deleting a task removes it and its comments for everyone.
                  </p>
                  <Link
                    href={`/tasks/${task.id}?confirm=delete`}
                    className={buttonClass({
                      variant: "outline",
                      size: "sm",
                      className: "mt-4 border-bad/40 text-bad hover:bg-bad/5",
                    })}
                  >
                    Delete task
                  </Link>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </span>
      {children}
    </div>
  );
}
