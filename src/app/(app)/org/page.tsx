import type { Metadata } from "next";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Percent,
  Sparkles,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import {
  dayKind,
  getHolidayMap,
  getPolicy,
  liveStatus,
} from "@/lib/attendance";
import {
  addDays,
  dateKey,
  fmtDateLong,
  fmtDateShort,
  fmtDuration,
  fmtWeekday,
  listDates,
  monthBounds,
  todayIST,
} from "@/lib/time";
import { cn, pct, plural } from "@/lib/utils";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { ProgressBar, SegmentBar } from "@/components/ui/progress";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { Spark } from "@/components/ui/spark";

export const metadata: Metadata = { title: "Organization" };

const PRESENTISH = new Set(["PRESENT", "LATE", "HALF_DAY"]);

/** Distribution bar colored per-project via inline hsl (hue comes from data). */
function HueBar({
  segments,
}: {
  segments: { value: number; hue: number; title: string }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
      {total <= 0 ? (
        <div className="h-full w-full rounded-full bg-surface-2" />
      ) : (
        segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <div
              key={i}
              title={s.title}
              className="h-full rounded-full"
              style={{
                width: `${(s.value / total) * 100}%`,
                backgroundColor: `hsl(${s.hue} 55% 46%)`,
              }}
            />
          ))
      )}
    </div>
  );
}

export default async function OrgPage() {
  await requireUser(["MANAGER", "HR", "FOUNDER", "SUPER_ADMIN"]);

  const today = todayIST();
  const { start: monthStart } = monthBounds(today);
  const [policy, holidayMap] = await Promise.all([getPolicy(), getHolidayMap()]);

  // Last 14 working days (including today), walking backwards.
  const trendDays: string[] = [];
  let cursor = today;
  for (let i = 0; i < 60 && trendDays.length < 14; i++) {
    if (dayKind(cursor, policy, holidayMap) === "WORKING") trendDays.unshift(cursor);
    cursor = addDays(cursor, -1);
  }
  const rangeStart =
    trendDays.length > 0 && trendDays[0] < monthStart ? trendDays[0] : monthStart;

  const [users, teams, projects, rangeAttendance, todayAttendance, tasks, reportsToday, plansToday, reportsMonth] =
    await Promise.all([
      db.user.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          role: true,
          teamId: true,
          joiningDate: true,
          employmentType: true,
        },
      }),
      db.team.findMany({ select: { id: true, name: true, department: true } }),
      db.project.findMany({
        select: { id: true, name: true, code: true, hue: true, status: true },
      }),
      db.attendance.findMany({
        where: { date: { gte: rangeStart, lte: today } },
        select: { userId: true, date: true, status: true, totalMinutes: true },
      }),
      db.attendance.findMany({
        where: { date: today },
        include: { breaks: true },
      }),
      db.task.findMany({
        where: { assignee: { status: "ACTIVE" } },
        select: {
          id: true,
          status: true,
          dueDate: true,
          teamId: true,
          projectId: true,
          assigneeId: true,
          completedAt: true,
        },
      }),
      db.dailyReport.findMany({ where: { date: today }, select: { userId: true } }),
      db.dailyPlan.findMany({ where: { date: today }, select: { userId: true } }),
      db.dailyReport.findMany({
        where: { date: { gte: monthStart, lte: today } },
        select: { userId: true },
      }),
    ]);

  const activeIds = new Set(users.map((u) => u.id));

  // ---- Today's pulse -------------------------------------------------------
  const attToday = new Map(
    todayAttendance.filter((a) => activeIds.has(a.userId)).map((a) => [a.userId, a]),
  );
  let working = 0;
  let onBreak = 0;
  let onLeave = 0;
  let clockedOut = 0;
  for (const u of users) {
    const ls = liveStatus(attToday.get(u.id));
    if (ls === "WORKING") working++;
    else if (ls === "BREAK") onBreak++;
    else if (ls === "LEAVE") onLeave++;
    else if (ls === "CLOCKED_OUT") clockedOut++;
  }
  const presentToday = working + onBreak + clockedOut;
  const notIn = Math.max(0, users.length - presentToday - onLeave);
  const clockedInCount = presentToday;

  // ---- This month, org-wide ------------------------------------------------
  const monthWorkingDays = listDates(monthStart, today).filter(
    (d) => dayKind(d, policy, holidayMap) === "WORKING",
  );
  const monthRows = rangeAttendance.filter(
    (a) => a.date >= monthStart && activeIds.has(a.userId),
  );
  const presentishRows = monthRows.filter((a) => PRESENTISH.has(a.status));
  const slots = monthWorkingDays.length * users.length;
  const attendancePct = pct(presentishRows.length, slots);

  const workedRows = monthRows.filter((a) => (a.totalMinutes ?? 0) > 0);
  const avgMinutes =
    workedRows.length > 0
      ? Math.round(
          workedRows.reduce((sum, a) => sum + (a.totalMinutes ?? 0), 0) /
            workedRows.length,
        )
      : 0;

  const lateCount = monthRows.filter((a) => a.status === "LATE").length;
  const latePct = pct(lateCount, presentishRows.length);

  // ---- Productivity --------------------------------------------------------
  const [my, mm, md] = monthStart.split("-").map(Number);
  const monthStartUtc = new Date(Date.UTC(my, mm - 1, md) - 330 * 60000);

  const completedThisMonth = tasks.filter(
    (t) => t.completedAt && t.completedAt >= monthStartUtc,
  ).length;
  const openTasks = tasks.filter((t) => t.status !== "COMPLETED");
  const overdueTasks = openTasks.filter((t) => t.dueDate && t.dueDate < today);
  const blockedTasks = openTasks.filter((t) => t.status === "BLOCKED");

  // ---- Accountability ------------------------------------------------------
  const reportsTodayCount = reportsToday.filter((r) => activeIds.has(r.userId)).length;
  const plansTodayCount = plansToday.filter((p) => activeIds.has(p.userId)).length;

  // ---- Cross-team comparison ----------------------------------------------
  const teamRows = teams
    .map((team) => {
      const members = users.filter((u) => u.teamId === team.id);
      const memberIds = new Set(members.map((m) => m.id));
      const memberPresentish = presentishRows.filter((a) => memberIds.has(a.userId));
      const teamSlots = monthWorkingDays.length * members.length;
      const teamTasks = tasks.filter((t) => t.teamId === team.id);
      const teamCompleted = teamTasks.filter((t) => t.status === "COMPLETED");
      const teamOpen = teamTasks.filter((t) => t.status !== "COMPLETED");
      const teamBlocked = teamTasks.filter((t) => t.status === "BLOCKED");
      const teamReports = reportsMonth.filter((r) => memberIds.has(r.userId));
      return {
        id: team.id,
        name: team.name,
        department: team.department,
        members: members.length,
        attendancePct: pct(memberPresentish.length, teamSlots),
        openTasks: teamOpen.length,
        completionPct: pct(teamCompleted.length, teamTasks.length),
        blocked: teamBlocked.length,
        reportingPct: Math.min(100, pct(teamReports.length, memberPresentish.length)),
      };
    })
    .sort((a, b) => b.attendancePct - a.attendancePct);
  const worstTeamId =
    teamRows.filter((t) => t.members > 0).slice(-1)[0]?.id ?? null;

  // ---- Project allocation --------------------------------------------------
  const allocation = projects
    .map((p) => {
      const open = openTasks.filter((t) => t.projectId === p.id);
      const people = new Set(open.map((t) => t.assigneeId)).size;
      return { ...p, open: open.length, people };
    })
    .filter((p) => p.open > 0)
    .sort((a, b) => b.open - a.open);
  const openWithProject = allocation.reduce((sum, p) => sum + p.open, 0);
  const peopleTotal = allocation.reduce((sum, p) => sum + p.people, 0);

  // ---- Attendance trend ----------------------------------------------------
  const trend = trendDays.map((d) => {
    const dayRows = rangeAttendance.filter(
      (a) => a.date === d && activeIds.has(a.userId) && PRESENTISH.has(a.status),
    );
    return { date: d, pct: pct(dayRows.length, users.length) };
  });

  // ---- Workforce facts -----------------------------------------------------
  const interns = users.filter(
    (u) => u.role === "INTERN" || u.employmentType === "INTERN",
  ).length;
  const sixtyDaysAgo = addDays(today, -60);
  const newJoiners = users.filter((u) => dateKey(u.joiningDate) >= sixtyDaysAgo).length;

  return (
    <div>
      <PageHeader
        eyebrow="Organization"
        title="STAIL at a Glance"
        description={`Live workforce pulse and this month's delivery picture · ${fmtDateLong(today)}`}
      />

      {/* Hero: today's pulse + monthly headline stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <PanelCard className="flex flex-col justify-between gap-8 md:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <CardLabel className="text-panel-ink opacity-60">
              Today&apos;s pulse
            </CardLabel>
            <Spark className="size-5 text-accent" />
          </div>
          <div>
            <p className="text-5xl font-semibold tracking-tighter tabular-nums md:text-6xl">
              {presentToday}
              <span className="opacity-40"> / {users.length}</span>
            </p>
            <p className="mt-1.5 text-sm opacity-60">people present today</p>
          </div>
          <div className="space-y-3">
            <SegmentBar
              segments={[
                { value: working, className: "bg-accent", title: `${working} working` },
                { value: onBreak, className: "bg-warn", title: `${onBreak} on break` },
                {
                  value: clockedOut,
                  className: "bg-panel-ink/40",
                  title: `${clockedOut} clocked out`,
                },
                {
                  value: onLeave,
                  className: "bg-panel-ink/20",
                  title: `${onLeave} on leave`,
                },
                { value: notIn, className: "bg-panel-ink/10", title: `${notIn} not in` },
              ]}
            />
            <p className="text-xs tabular-nums opacity-60">
              {working} working now · {onBreak} on break · {onLeave} on leave ·{" "}
              {notIn} not in
            </p>
          </div>
        </PanelCard>

        <StatCard
          label="Attendance rate"
          value={`${attendancePct}%`}
          sub={`${presentishRows.length} of ${slots} working-day slots`}
          icon={<Percent className="size-4" />}
        />
        <StatCard
          label="Avg working hours"
          value={fmtDuration(avgMinutes)}
          sub="per person-day this month"
          icon={<Clock3 className="size-4" />}
        />
        <StatCard
          label="Late rate"
          value={`${latePct}%`}
          sub={`${plural(lateCount, "late arrival")} this month`}
          icon={<CalendarClock className="size-4" />}
        />
      </div>

      {/* Productivity */}
      <SectionTitle title="Productivity" className="mt-8" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="accent"
          label="Tasks completed"
          value={completedThisMonth}
          sub="this month"
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatCard
          label="Open"
          value={openTasks.length}
          sub={`${openTasks.filter((t) => t.status === "IN_PROGRESS").length} in progress`}
          icon={<CircleDashed className="size-4" />}
        />
        <StatCard
          label="Overdue"
          value={overdueTasks.length}
          sub="past their due date"
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Blocked"
          value={blockedTasks.length}
          sub="waiting on something"
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      {/* Accountability */}
      <SectionTitle title="Accountability today" className="mt-8" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-baseline justify-between gap-3">
            <CardLabel>Daily reports today</CardLabel>
            <span className="text-xs tabular-nums text-ink-faint">
              {pct(reportsTodayCount, clockedInCount)}%
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
            {reportsTodayCount}
            <span className="text-xl text-ink-faint"> / {clockedInCount}</span>
          </p>
          <ProgressBar className="mt-4" value={reportsTodayCount} max={clockedInCount} />
          <p className="mt-2.5 text-xs text-ink-soft">
            reports submitted by the {plural(clockedInCount, "person", "people")} who
            clocked in
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-baseline justify-between gap-3">
            <CardLabel>Plans submitted today</CardLabel>
            <span className="text-xs tabular-nums text-ink-faint">
              {pct(plansTodayCount, clockedInCount)}%
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
            {plansTodayCount}
            <span className="text-xl text-ink-faint"> / {clockedInCount}</span>
          </p>
          <ProgressBar
            className="mt-4"
            value={plansTodayCount}
            max={clockedInCount}
            barClassName="bg-ink"
          />
          <p className="mt-2.5 text-xs text-ink-soft">
            day plans in from the {plural(clockedInCount, "person", "people")} who
            clocked in
          </p>
        </Card>
      </div>

      {/* Cross-team comparison */}
      <SectionTitle title="Team comparison" className="mt-8" />
      {teamRows.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="No teams yet"
          hint="Teams will appear here once people are organized into them."
        />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Team</Th>
                <Th>Members</Th>
                <Th>Attendance</Th>
                <Th>Open tasks</Th>
                <Th>Completion</Th>
                <Th>Blocked</Th>
                <Th>Reporting</Th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((t) => {
                const worst = t.id === worstTeamId;
                return (
                  <Tr key={t.id}>
                    <Td>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-ink-faint">{t.department}</p>
                    </Td>
                    <Td className="tabular-nums">{t.members}</Td>
                    <Td>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          worst && "text-warn",
                        )}
                      >
                        {t.attendancePct}%
                      </span>
                      {worst && (
                        <span className="ml-2 text-[11px] uppercase tracking-wide text-warn/80">
                          lowest
                        </span>
                      )}
                    </Td>
                    <Td className="tabular-nums">{t.openTasks}</Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <ProgressBar
                          value={t.completionPct}
                          className="w-20"
                          barClassName="bg-ink"
                        />
                        <span className="tabular-nums text-ink-soft">
                          {t.completionPct}%
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          "tabular-nums",
                          t.blocked > 0 && "font-medium text-bad",
                        )}
                      >
                        {t.blocked}
                      </span>
                    </Td>
                    <Td className="tabular-nums">{t.reportingPct}%</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {/* Allocation + trend */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight">
              Project allocation
            </h2>
            <span className="text-xs text-ink-faint">open work · right now</span>
          </div>
          {allocation.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title="No open project work"
              hint="Open tasks assigned to projects will show up here."
              className="py-8"
            />
          ) : (
            <div className="space-y-6">
              <div>
                <CardLabel className="mb-2">Share of open tasks</CardLabel>
                <HueBar
                  segments={allocation.map((p) => ({
                    value: p.open,
                    hue: p.hue,
                    title: `${p.name} · ${plural(p.open, "open task")}`,
                  }))}
                />
              </div>
              <div>
                <CardLabel className="mb-2">Share of people</CardLabel>
                <HueBar
                  segments={allocation.map((p) => ({
                    value: p.people,
                    hue: p.hue,
                    title: `${p.name} · ${plural(p.people, "person", "people")}`,
                  }))}
                />
              </div>
              <ul className="space-y-2.5">
                {allocation.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: `hsl(${p.hue} 55% 46%)` }}
                      />
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-[11px] uppercase tracking-wide text-ink-faint">
                        {p.code}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                      {pct(p.open, openWithProject)}% tasks ·{" "}
                      {pct(p.people, peopleTotal)}% people
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight">
              Attendance trend
            </h2>
            <span className="text-xs text-ink-faint">
              last {trend.length} working days · % present
            </span>
          </div>
          {trend.length === 0 ? (
            <EmptyState
              title="No working days yet"
              hint="The trend appears once working days accumulate."
              className="py-8"
            />
          ) : (
            <div>
              <div className="flex items-end gap-1.5">
                {trend.map((t) => (
                  <div
                    key={t.date}
                    className="flex flex-1 flex-col items-center gap-1"
                    title={`${fmtDateShort(t.date)} · ${t.pct}% present`}
                  >
                    <span className="hidden text-[10px] tabular-nums text-ink-faint sm:block">
                      {t.pct}
                    </span>
                    <div className="flex h-24 w-full items-end border-b border-line">
                      <div
                        className="w-full rounded-t bg-accent"
                        style={{ height: `${t.pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-ink-faint">
                      {fmtWeekday(t.date).slice(0, 2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
                <span>{fmtDateShort(trend[0].date)}</span>
                <span>{fmtDateShort(trend[trend.length - 1].date)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Workforce facts */}
      <SectionTitle title="Workforce" className="mt-8" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total people" value={users.length} sub="active across STAIL" />
        <StatCard label="Interns" value={interns} sub="learning on the job" />
        <StatCard label="New joiners" value={newJoiners} sub="joined in the last 60 days" />
        <StatCard label="Teams" value={teams.length} sub="across the org" />
      </div>
    </div>
  );
}
