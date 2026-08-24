import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, FolderKanban, ListTodo, NotebookPen, Pencil } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { canViewUser, isAdmin, isOrg } from "@/lib/rbac";
import {
  attendanceRate,
  dayKind,
  getHolidayMap,
  getPolicy,
} from "@/lib/attendance";
import {
  EMPLOYMENT_TYPE_LABELS,
  ROLE_LABELS,
  type EmploymentType,
  type Role,
} from "@/lib/definitions";
import {
  dateKey,
  fmtDateFull,
  fmtDateShort,
  fmtDuration,
  fmtTime,
  fmtWeekday,
  lastNDays,
  listDates,
  monthBounds,
  todayIST,
} from "@/lib/time";
import { pct, toLines } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { SectionTitle } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";

function PanelMeta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">{label}</p>
      <div className="mt-1 text-sm font-medium tracking-tight">{value}</div>
    </div>
  );
}

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;

  if (viewer.id !== id && !(await canViewUser(viewer, id))) {
    redirect("/dashboard");
  }

  const person = await db.user.findUnique({
    where: { id },
    include: {
      team: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
    },
  });
  if (!person) notFound();

  const today = todayIST();
  const { start: monthStart } = monthBounds(today);

  const [policy, holidayMap, monthAtt, recentAtt, tasks, reports, projectRows, todayPlan] =
    await Promise.all([
      getPolicy(),
      getHolidayMap(),
      db.attendance.findMany({
        where: { userId: id, date: { gte: monthStart, lte: today } },
      }),
      db.attendance.findMany({
        where: { userId: id, date: { gte: lastNDays(14)[0], lte: today } },
        orderBy: { date: "desc" },
      }),
      db.task.findMany({
        where: { assigneeId: id },
        select: { status: true, completedAt: true, dueDate: true },
      }),
      db.dailyReport.findMany({
        where: { userId: id },
        orderBy: { date: "desc" },
        take: 3,
      }),
      db.task.findMany({
        where: { assigneeId: id, projectId: { not: null } },
        distinct: ["projectId"],
        select: { project: { select: { id: true, name: true, code: true, hue: true } } },
      }),
      db.dailyPlan.findUnique({
        where: { userId_date: { userId: id, date: todayIST() } },
      }),
    ]);

  // — This month —
  const workingDays = listDates(monthStart, today).filter(
    (d) => dayKind(d, policy, holidayMap) === "WORKING",
  ).length;
  const presentIsh = monthAtt.filter((a) =>
    ["PRESENT", "LATE", "HALF_DAY"].includes(a.status),
  );
  const attRate = attendanceRate(presentIsh.length, workingDays);
  const withMinutes = presentIsh.filter((a) => (a.totalMinutes ?? 0) > 0);
  const avgMinutes =
    withMinutes.length > 0
      ? Math.round(
          withMinutes.reduce((s, a) => s + (a.totalMinutes ?? 0), 0) / withMinutes.length,
        )
      : 0;
  const lates = monthAtt.filter((a) => a.status === "LATE").length;
  const leaves = monthAtt.filter((a) => a.status === "LEAVE").length;

  // — Work —
  const completed = tasks.filter((t) => t.status === "COMPLETED");
  const backlog = tasks.filter((t) => t.status === "BACKLOG").length;
  const open = tasks.length - completed.length - backlog;
  const completedMonth = completed.filter(
    (t) => t.completedAt && dateKey(t.completedAt) >= monthStart,
  ).length;
  const overdue = tasks.filter(
    (t) => t.status !== "COMPLETED" && t.dueDate && t.dueDate < today,
  ).length;
  const completionRate = pct(completed.length, tasks.length);

  const projects = projectRows
    .map((r) => r.project)
    .filter((p): p is NonNullable<typeof p> => p != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const admin = isAdmin(viewer.role);
  const canBrowseDirectory = isOrg(viewer.role);

  return (
    <div>
      {canBrowseDirectory && (
        <Link
          href="/people"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> All people
        </Link>
      )}
      {/* Hero */}
      <PanelCard className="mb-6 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-5">
            <Avatar name={person.name} hue={person.avatarHue} size="xl" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-60">
                {person.title ?? "Team member"}
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight md:text-[32px]">
                {person.name}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={person.status} />
                <span className="rounded-full border border-panel-line px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide opacity-80">
                  {ROLE_LABELS[person.role as Role] ?? person.role}
                </span>
                <span className="rounded-full border border-panel-line px-2.5 py-1 font-mono text-[11px] tracking-wide opacity-80">
                  {person.employeeCode}
                </span>
                <span className="rounded-full border border-panel-line px-2.5 py-1 text-[11px] uppercase tracking-wide opacity-80">
                  {EMPLOYMENT_TYPE_LABELS[person.employmentType as EmploymentType] ??
                    person.employmentType}
                </span>
              </div>
            </div>
          </div>
          {admin && (
            <Link
              href={`/people/${person.id}/edit`}
              className={buttonClass({ variant: "accent", size: "sm" })}
            >
              <Pencil className="size-3.5" />
              Edit
            </Link>
          )}
        </div>
        <div className="mt-7 grid grid-cols-2 gap-5 border-t border-panel-line pt-6 md:grid-cols-4">
          <PanelMeta label="Team" value={person.team?.name ?? "No team"} />
          <PanelMeta label="Joined" value={fmtDateFull(dateKey(person.joiningDate))} />
          <PanelMeta
            label="Manager"
            value={
              person.manager ? (
                <Link href={`/people/${person.manager.id}`} className="underline-offset-2 hover:underline">
                  {person.manager.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <PanelMeta label="Email" value={<span className="break-all">{person.email}</span>} />
        </div>
      </PanelCard>

      {/* This month */}
      <SectionTitle title="This month" />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Attendance"
          value={`${attRate}%`}
          sub={`${presentIsh.length} of ${workingDays} working days`}
        />
        <StatCard label="Avg hours" value={fmtDuration(avgMinutes)} sub="per attended day" />
        <StatCard label="Lates" value={lates} sub="after grace window" />
        <StatCard label="Leaves" value={leaves} sub="days on leave" />
      </div>

      {/* Work */}
      <SectionTitle title="Work" />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open tasks" value={open} sub={`${backlog} in backlog`} />
        <StatCard label="Completed" value={completedMonth} sub="this month" />
        <StatCard label="Overdue" value={overdue} sub="past due date" />
        <StatCard
          label="Completion rate"
          value={`${completionRate}%`}
          sub={`${completed.length} of ${tasks.length} all-time`}
        />
      </div>

      {todayPlan && (
        <Card className="mb-4">
          <div className="flex items-center gap-2.5">
            <ListTodo className="size-4 text-ink-faint" />
            <h2 className="text-base font-semibold tracking-tight">
              Today&apos;s plan
            </h2>
            <span className="text-[11px] text-ink-faint">
              submitted {fmtTime(todayPlan.submittedAt)}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {toLines(todayPlan.priorities).map((line, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-accent" />
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
          {todayPlan.deliverables && (
            <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
              <span className="font-medium uppercase tracking-wide text-ink-faint">
                Deliverables:{" "}
              </span>
              {todayPlan.deliverables}
            </p>
          )}
        </Card>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[1.2fr_1fr]">
        {/* Recent attendance */}
        <div>
          <SectionTitle title="Recent attendance" />
          {recentAtt.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="No attendance records yet"
              hint="Days will appear here once they clock in."
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th>In</Th>
                    <Th>Out</Th>
                    <Th>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentAtt.map((a) => (
                    <Tr key={a.id}>
                      <Td className="whitespace-nowrap">
                        <span className="font-medium tabular-nums">{fmtDateShort(a.date)}</span>
                        <span className="ml-2 text-xs text-ink-faint">{fmtWeekday(a.date)}</span>
                      </Td>
                      <Td>
                        <StatusBadge status={a.status} />
                      </Td>
                      <Td className="tabular-nums text-ink-soft">{fmtTime(a.clockIn)}</Td>
                      <Td className="tabular-nums text-ink-soft">{fmtTime(a.clockOut)}</Td>
                      <Td className="tabular-nums">{fmtDuration(a.totalMinutes)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Projects involved */}
          <Card>
            <CardLabel>Projects involved</CardLabel>
            {projects.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-faint">
                <FolderKanban className="size-4" />
                No project work assigned yet.
              </p>
            ) : (
              <div className="mt-3.5 flex flex-wrap gap-2">
                {projects.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-medium"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: `hsl(${p.hue} 55% 48%)` }}
                    />
                    {p.name}
                    <span className="font-mono text-[10px] text-ink-faint">{p.code}</span>
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Recent daily reports */}
          <div>
            <SectionTitle title="Recent daily reports" className="mb-3" />
            {reports.length === 0 ? (
              <EmptyState
                icon={<NotebookPen className="size-6" />}
                title="No daily reports yet"
                hint="End-of-day reports will show up here once submitted."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {reports.map((r) => {
                  const wins = toLines(r.accomplishments);
                  const blockers = toLines(r.blockers);
                  return (
                    <Card key={r.id} className="p-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold tracking-tight">
                          {fmtDateShort(r.date)}
                          <span className="ml-2 text-xs font-normal text-ink-faint">
                            {fmtWeekday(r.date)} · submitted {fmtTime(r.submittedAt)}
                          </span>
                        </p>
                      </div>
                      <CardLabel>Accomplished</CardLabel>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {wins.slice(0, 3).map((line, i) => (
                          <li key={i} className="flex gap-2 text-sm text-ink-soft">
                            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
                            <span>{line}</span>
                          </li>
                        ))}
                        {wins.length > 3 && (
                          <li className="text-xs text-ink-faint">+{wins.length - 3} more</li>
                        )}
                      </ul>
                      {blockers.length > 0 && (
                        <p className="mt-3 text-xs text-bad">
                          <span className="font-medium uppercase tracking-wide">Blockers:</span>{" "}
                          {blockers.join(" · ")}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
