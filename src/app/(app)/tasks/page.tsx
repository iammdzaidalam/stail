import Link from "next/link";
import { Check, ClipboardList, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isManagerial, visibleTeamIds } from "@/lib/rbac";
import { todayIST, weekBounds, fmtDateShort, dateKey } from "@/lib/time";
import { cn, plural } from "@/lib/utils";
import type { TaskStatus } from "@/lib/definitions";
import { buttonClass, Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { LinkTabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { updateStatus } from "./actions";
import { QUICK_ADVANCE } from "./task-flow";

const ACTIVE_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW"];

const STATUS_TABS = [
  { key: "active", label: "Active" },
  { key: "backlog", label: "Backlog" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
] as const;

type StatusTabKey = (typeof STATUS_TABS)[number]["key"];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const managerial = isManagerial(user.role);
  const rawStatus = typeof sp.status === "string" ? sp.status : "active";
  const statusKey: StatusTabKey = STATUS_TABS.some((t) => t.key === rawStatus)
    ? (rawStatus as StatusTabKey)
    : "active";
  const scope = managerial && sp.scope === "team" ? "team" : "me";
  const projectParam = typeof sp.project === "string" ? sp.project : "";

  // Scope: my tasks, or (managerial) tasks of everyone in my visible teams.
  let scopeWhere: Prisma.TaskWhereInput = { assigneeId: user.id };
  if (scope === "team") {
    const ids = await visibleTeamIds(user);
    if (ids === "ALL") scopeWhere = {};
    else if (ids.length > 0) scopeWhere = { assignee: { teamId: { in: ids } } };
  }
  const baseWhere: Prisma.TaskWhereInput = {
    ...scopeWhere,
    ...(projectParam ? { projectId: projectParam } : {}),
  };

  const today = todayIST();
  const week = weekBounds(today);

  const statusWhere: Prisma.TaskWhereInput =
    statusKey === "active"
      ? { status: { in: ACTIVE_STATUSES } }
      : statusKey === "backlog"
        ? { status: "BACKLOG" }
        : statusKey === "completed"
          ? { status: "COMPLETED" }
          : {};

  const [byStatus, dueThisWeek, overdue, projects, tasks] = await Promise.all([
    db.task.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    db.task.count({
      where: {
        ...baseWhere,
        status: { not: "COMPLETED" },
        dueDate: { gte: week.start, lte: week.end },
      },
    }),
    db.task.count({
      where: {
        ...baseWhere,
        status: { not: "COMPLETED" },
        dueDate: { lt: today },
      },
    }),
    db.project.findMany({
      where: { tasks: { some: scopeWhere } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, hue: true },
    }),
    db.task.findMany({
      where: { ...baseWhere, ...statusWhere },
      orderBy: [
        { dueDate: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: 200,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        assigneeId: true,
        creatorId: true,
        project: { select: { id: true, name: true, hue: true } },
        assignee: { select: { id: true, name: true, avatarHue: true } },
      },
    }),
  ]);

  const countOf = (s: TaskStatus) =>
    byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const open = ACTIVE_STATUSES.reduce((sum, s) => sum + countOf(s), 0);
  const backlog = countOf("BACKLOG");
  const completed = countOf("COMPLETED");
  const blocked = countOf("BLOCKED");
  const total = open + backlog + completed;

  // Build hrefs preserving the other filters; defaults are omitted.
  const href = (over: {
    status?: StatusTabKey;
    project?: string;
    scope?: "me" | "team";
  }) => {
    const merged = {
      status: over.status ?? statusKey,
      project: over.project ?? projectParam,
      scope: over.scope ?? scope,
    };
    const p = new URLSearchParams();
    if (merged.status !== "active") p.set("status", merged.status);
    if (merged.project) p.set("project", merged.project);
    if (merged.scope !== "me") p.set("scope", merged.scope);
    const s = p.toString();
    return s ? `/tasks?${s}` : "/tasks";
  };

  const tabCounts: Record<StatusTabKey, number> = {
    active: open,
    backlog,
    completed,
    all: total,
  };

  const showAssignee = scope === "team";

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title={scope === "team" ? "Team Tasks" : "My Tasks"}
        description={
          scope === "team"
            ? `${plural(total, "task")} across the people you manage.`
            : `${plural(total, "task")} assigned to you.`
        }
        actions={
          <Link href="/tasks/new" className={buttonClass({ variant: "accent" })}>
            <Plus className="size-4" />
            New task
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open" value={open} sub="In flight right now" tone="panel" />
        <StatCard
          label="Due this week"
          value={dueThisWeek}
          sub={`${fmtDateShort(week.start)} – ${fmtDateShort(week.end)}`}
        />
        <StatCard
          label="Overdue"
          value={<span className={cn(overdue > 0 && "text-bad")}>{overdue}</span>}
          sub="Past due, not completed"
        />
        <StatCard label="Blocked" value={blocked} sub="Waiting on something" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <LinkTabs
          tabs={STATUS_TABS.map((t) => ({
            href: href({ status: t.key }),
            label: t.label,
            active: statusKey === t.key,
            count: tabCounts[t.key],
          }))}
        />
        {managerial && (
          <LinkTabs
            tabs={[
              { href: href({ scope: "me" }), label: "My tasks", active: scope === "me" },
              { href: href({ scope: "team" }), label: "Team", active: scope === "team" },
            ]}
          />
        )}
      </div>

      {projects.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Link
            href={href({ project: "" })}
            className={projectChipClass(!projectParam)}
          >
            All projects
          </Link>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={href({ project: p.id })}
              className={projectChipClass(projectParam === p.id)}
            >
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: `hsl(${p.hue} 65% 55%)` }}
              />
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title={
            statusKey === "completed"
              ? "Nothing completed yet"
              : statusKey === "backlog"
                ? "The backlog is empty"
                : projectParam
                  ? "No tasks match these filters"
                  : "No tasks here"
          }
          hint={
            projectParam
              ? "Try a different project or status filter."
              : statusKey === "active"
                ? "You're all caught up. Create a task to get started."
                : undefined
          }
          action={
            !projectParam && statusKey === "active" ? (
              <Link
                href="/tasks/new"
                className={buttonClass({ variant: "outline", size: "sm" })}
              >
                <Plus className="size-4" />
                New task
              </Link>
            ) : undefined
          }
        />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Task</Th>
                {showAssignee && <Th>Assignee</Th>}
                <Th>Project</Th>
                <Th>Priority</Th>
                <Th>Due</Th>
                <Th>Status</Th>
                <Th className="text-right">Quick actions</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const isOverdue =
                  t.dueDate != null && t.dueDate < today && t.status !== "COMPLETED";
                const advance = QUICK_ADVANCE[t.status as TaskStatus];
                const canAct =
                  t.assigneeId === user.id || t.creatorId === user.id || managerial;
                return (
                  <Tr key={t.id}>
                    <Td className="max-w-[340px]">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="block truncate font-medium tracking-tight hover:underline"
                      >
                        {t.title}
                      </Link>
                    </Td>
                    {showAssignee && (
                      <Td>
                        <span className="flex items-center gap-2">
                          <Avatar
                            name={t.assignee.name}
                            hue={t.assignee.avatarHue}
                            size="xs"
                          />
                          <span className="whitespace-nowrap text-ink-soft">
                            {t.assignee.name}
                          </span>
                        </span>
                      </Td>
                    )}
                    <Td>
                      {t.project ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block size-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: `hsl(${t.project.hue} 65% 55%)`,
                            }}
                          />
                          <span className="whitespace-nowrap text-ink-soft">
                            {t.project.name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={t.priority} />
                    </Td>
                    <Td
                      className={cn(
                        "whitespace-nowrap tabular-nums",
                        isOverdue ? "font-medium text-bad" : "text-ink-soft",
                      )}
                    >
                      {t.dueDate ? fmtDateShort(t.dueDate) : "—"}
                    </Td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td className="text-right">
                      {canAct && t.status !== "COMPLETED" ? (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {advance && (
                            <form action={updateStatus}>
                              <input type="hidden" name="taskId" value={t.id} />
                              <input type="hidden" name="status" value={advance.to} />
                              <Button type="submit" size="sm" variant="outline">
                                {advance.label}
                              </Button>
                            </form>
                          )}
                          {t.status !== "IN_REVIEW" && (
                            <form action={updateStatus}>
                              <input type="hidden" name="taskId" value={t.id} />
                              <input type="hidden" name="status" value="COMPLETED" />
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                className="px-2.5"
                                title="Mark complete"
                                aria-label="Mark complete"
                              >
                                <Check className="size-4" />
                              </Button>
                            </form>
                          )}
                        </span>
                      ) : t.status === "COMPLETED" && t.completedAt ? (
                        <span className="whitespace-nowrap text-xs text-ink-faint">
                          Done {fmtDateShort(dateKey(t.completedAt))}
                        </span>
                      ) : null}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}

function projectChipClass(active: boolean): string {
  return cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
    active
      ? "border-line-strong bg-ink text-bg"
      : "border-line bg-surface text-ink-soft hover:bg-surface-2/60 hover:text-ink",
  );
}
