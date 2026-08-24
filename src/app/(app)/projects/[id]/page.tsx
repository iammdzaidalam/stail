import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ListChecks, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/session";
import { visibleTeamIds } from "@/lib/rbac";
import { db } from "@/lib/db";
import { dateKey, fmtDateFull, fmtDateShort, monthBounds, timeAgo, todayIST } from "@/lib/time";
import { cn, pct } from "@/lib/utils";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/definitions";
import { Card, CardLabel } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { SegmentBar } from "@/components/ui/progress";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Project" };

const MIX: { status: TaskStatus; className: string }[] = [
  { status: "COMPLETED", className: "bg-good" },
  { status: "IN_PROGRESS", className: "bg-accent" },
  { status: "BLOCKED", className: "bg-bad" },
  { status: "IN_REVIEW", className: "bg-ink/30" },
  { status: "TODO", className: "bg-ink/30" },
  { status: "BACKLOG", className: "bg-ink/30" },
];

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      team: { select: { name: true, department: true } },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true, avatarHue: true } },
          comments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { author: { select: { name: true } } },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!project) notFound();

  const today = todayIST();
  const { start: monthStart } = monthBounds(today);
  const [my, mm, md] = monthStart.split("-").map(Number);
  const monthStartUtc = new Date(Date.UTC(my, mm - 1, md) - 330 * 60000);

  const tasks = project.tasks;

  // Aggregate stats are visible to everyone, but task-level detail (titles,
  // assignees, comment bodies) follows the same scoping as /tasks: org roles
  // see everything, leads see their teams' projects, everyone else sees only
  // their own tasks here.
  const vt = await visibleTeamIds(user);
  const fullVisibility =
    vt === "ALL" || (project.teamId != null && vt.includes(project.teamId));
  const detailTasks = fullVisibility
    ? tasks
    : tasks.filter((t) => t.assignee.id === user.id);

  const completed = tasks.filter((t) => t.status === "COMPLETED");
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS");
  const blocked = tasks.filter((t) => t.status === "BLOCKED");
  const blockedDetail = detailTasks.filter((t) => t.status === "BLOCKED");
  const open = detailTasks
    .filter((t) => t.status !== "COMPLETED")
    .sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"));
  const completedThisMonth = completed.filter(
    (t) => t.completedAt && t.completedAt >= monthStartUtc,
  ).length;
  const people = [
    ...new Map(
      tasks
        .filter((t) => t.status !== "COMPLETED")
        .map((t) => [t.assignee.id, t.assignee]),
    ).values(),
  ];
  const recentCompletions = detailTasks
    .filter((t) => t.status === "COMPLETED")
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .slice(0, 8);

  const mixCounts = MIX.map((m) => ({
    ...m,
    count: tasks.filter((t) => t.status === m.status).length,
  }));

  return (
    <div>
      <PageHeader
        eyebrow={project.team ? `Project · ${project.team.name}` : "Project"}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: `hsl(${project.hue} 55% 46%)` }}
            />
            {project.name}
          </span>
        }
        description={project.description || undefined}
        actions={
          <>
            <Badge tone="outline">{project.code}</Badge>
            <StatusBadge status={project.status} />
            <Link
              href="/projects"
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              <ArrowLeft className="size-4" /> All projects
            </Link>
          </>
        }
      />

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard tone="panel" label="Total tasks" value={tasks.length} sub="all time" />
        <StatCard
          label="Completed"
          value={completed.length}
          sub={`${pct(completed.length, tasks.length)}% of all tasks`}
        />
        <StatCard label="In progress" value={inProgress.length} sub="being worked on" />
        <StatCard
          label="Blocked"
          value={
            <span className={cn(blocked.length > 0 && "text-bad")}>
              {blocked.length}
            </span>
          }
          sub={blocked.length > 0 ? "needs attention" : "all clear"}
        />
        <StatCard
          label="Completed this month"
          value={completedThisMonth}
          sub={`since ${fmtDateShort(monthStart)}`}
        />
        <StatCard
          label="People on it"
          value={people.length}
          sub={
            people.length > 0 ? (
              <AvatarStack
                people={people.map((p) => ({ name: p.name, hue: p.avatarHue }))}
                max={5}
              />
            ) : (
              "no active assignees"
            )
          }
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Blocked call-out */}
          {!fullVisibility && (
            <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-xs text-ink-soft">
              Showing only your tasks on this project — full team detail is
              visible to leads and managers.
            </p>
          )}
          {blockedDetail.length > 0 && (
            <Card className="border-warn/40 bg-warn/5">
              <div className="mb-4 flex items-center gap-2.5">
                <TriangleAlert className="size-4 text-warn" />
                <h2 className="text-base font-semibold tracking-tight">
                  Blocked work
                </h2>
                <Badge tone="warn">{blockedDetail.length}</Badge>
              </div>
              <div className="divide-y divide-line">
                {blockedDetail.map((t) => {
                  const note = t.comments[0];
                  return (
                    <div key={t.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/tasks/${t.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {t.title}
                        </Link>
                        <StatusBadge status={t.priority} />
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
                        <Avatar name={t.assignee.name} hue={t.assignee.avatarHue} size="xs" />
                        {t.assignee.name}
                      </div>
                      {note ? (
                        <p className="mt-1.5 text-xs text-ink-soft">
                          &ldquo;{note.body}&rdquo;
                          <span className="text-ink-faint">
                            {" "}
                            — {note.author.name}, {timeAgo(note.createdAt)}
                          </span>
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs text-ink-faint">
                          No blocker note yet.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Open tasks */}
          <section>
            <SectionTitle
              title="Open tasks"
              action={
                <span className="text-xs text-ink-faint">
                  {open.length} open
                </span>
              }
            />
            {open.length === 0 ? (
              <EmptyState
                icon={<ListChecks className="size-5" />}
                title={fullVisibility ? "No open tasks" : "No open tasks of yours here"}
                hint={
                  fullVisibility
                    ? "Everything on this project is completed."
                    : "You have no open tasks on this project — the tiles above still show the whole project's numbers."
                }
              />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Task</Th>
                      <Th>Assignee</Th>
                      <Th>Priority</Th>
                      <Th>Due</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.map((t) => {
                      const overdue = !!t.dueDate && t.dueDate < today;
                      return (
                        <Tr key={t.id}>
                          <Td className="max-w-80">
                            <Link
                              href={`/tasks/${t.id}`}
                              className="block max-w-80 truncate font-medium hover:underline"
                            >
                              {t.title}
                            </Link>
                          </Td>
                          <Td>
                            <span className="flex items-center gap-2">
                              <Avatar
                                name={t.assignee.name}
                                hue={t.assignee.avatarHue}
                                size="xs"
                              />
                              {t.assignee.name}
                            </span>
                          </Td>
                          <Td>
                            <StatusBadge status={t.priority} />
                          </Td>
                          <Td>
                            <span
                              className={cn(
                                "tabular-nums",
                                overdue && "font-medium text-bad",
                              )}
                            >
                              {t.dueDate ? fmtDateShort(t.dueDate) : "—"}
                            </span>
                          </Td>
                          <Td>
                            <StatusBadge status={t.status} />
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </section>
        </div>

        <div className="space-y-4">
          {/* Status mix */}
          <Card>
            <CardLabel className="mb-4">Status mix</CardLabel>
            <SegmentBar
              className="h-2.5"
              segments={mixCounts.map((m) => ({
                value: m.count,
                className: m.className,
                title: `${TASK_STATUS_LABELS[m.status]} · ${m.count}`,
              }))}
            />
            <ul className="mt-4 space-y-2">
              {mixCounts
                .filter((m) => m.count > 0)
                .map((m) => (
                  <li
                    key={m.status}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={cn("size-2 rounded-full", m.className)} />
                      {TASK_STATUS_LABELS[m.status]}
                    </span>
                    <span className="tabular-nums text-ink-soft">
                      {m.count}
                      <span className="text-ink-faint">
                        {" "}
                        · {pct(m.count, tasks.length)}%
                      </span>
                    </span>
                  </li>
                ))}
              {tasks.length === 0 && (
                <li className="text-xs text-ink-faint">No tasks yet.</li>
              )}
            </ul>
          </Card>

          {/* Recent completions */}
          <Card>
            <CardLabel className="mb-4">Recent completions</CardLabel>
            {recentCompletions.length === 0 ? (
              <p className="text-xs text-ink-faint">Nothing completed yet.</p>
            ) : (
              <div className="divide-y divide-line">
                {recentCompletions.map((t) => (
                  <div key={t.id} className="flex items-start gap-2.5 py-3 first:pt-0 last:pb-0">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good" />
                    <div className="min-w-0">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {t.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {t.assignee.name}
                        {t.completedAt &&
                          ` · ${fmtDateFull(dateKey(t.completedAt))}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
