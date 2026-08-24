import Link from "next/link";
import { Check, ShieldCheck, Users } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import {
  dayKind,
  getHolidayMap,
  getPolicy,
  liveStatus,
  workedMinutes,
} from "@/lib/attendance";
import {
  addDays,
  fmtDateLong,
  fmtDuration,
  fmtTime,
  fmtWeekday,
  listDates,
  todayIST,
  weekBounds,
} from "@/lib/time";
import { cn, pct, plural, toLines } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/lib/definitions";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import {
  getMembers,
  getVisibleTeams,
  istStartOfDay,
  OPEN_TASK_STATUSES,
  PRESENT_STATUSES,
  resolveSelection,
  teamTabs,
} from "./shared";

const STALE_BLOCKED_MS = 3 * 24 * 60 * 60 * 1000;

type Flag = { label: string; tone: "warn" | "bad" };

export default async function TeamOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["TEAM_LEAD", "MANAGER", "HR", "FOUNDER"]);
  const sp = await searchParams;
  const teams = await getVisibleTeams(user);
  const today = todayIST();

  if (teams.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Team"
          title="Team Overview"
          description="Attendance, workload and attention flags for your teams."
        />
        <EmptyState
          icon={<Users className="size-6" />}
          title="No teams visible yet"
          hint="You are not linked to any team as its lead. Ask HR to assign you to a team to unlock team dashboards."
        />
      </>
    );
  }

  const { selected, teamIds } = resolveSelection(teams, sp.team);
  const members = await getMembers(teamIds);
  const memberIds = members.map((m) => m.id);
  const tabs = teamTabs("/team", teams, selected);
  const scopeLabel = selected
    ? `${selected.name} · ${selected.department}`
    : `All teams · ${plural(teams.length, "team")}`;

  if (members.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Team" title="Team Overview" description={fmtDateLong(today)} />
        <div className="mb-6">
          <LinkTabs tabs={tabs} />
        </div>
        <EmptyState
          icon={<Users className="size-6" />}
          title="No members in this team yet"
          hint="Once people are assigned to this team, their attendance and work will appear here."
        />
      </>
    );
  }

  const [policy, holidayMap] = await Promise.all([getPolicy(), getHolidayMap()]);

  // Last 10 working days (per policy + holiday calendar), oldest first.
  const trendDays: string[] = [];
  {
    let cursor = today;
    let guard = 0;
    while (trendDays.length < 10 && guard < 40) {
      if (dayKind(cursor, policy, holidayMap) === "WORKING") trendDays.push(cursor);
      cursor = addDays(cursor, -1);
      guard++;
    }
    trendDays.reverse();
  }

  const windowStart = addDays(today, -13); // 14-day attention window
  const histStart =
    trendDays.length > 0 && trendDays[0] < windowStart ? trendDays[0] : windowStart;
  const { start: weekStart } = weekBounds(today);
  const now = new Date();

  const [todayAtt, histAtt, plansToday, reportsToday, windowReports, openTasks, completedThisWeek] =
    await Promise.all([
      db.attendance.findMany({
        where: { date: today, userId: { in: memberIds } },
        include: { breaks: true },
      }),
      db.attendance.findMany({
        where: { userId: { in: memberIds }, date: { gte: histStart, lte: today } },
        select: { userId: true, date: true, status: true },
      }),
      db.dailyPlan.findMany({
        where: { date: today, userId: { in: memberIds } },
        select: { userId: true, priorities: true },
      }),
      db.dailyReport.findMany({
        where: { date: today, userId: { in: memberIds } },
        select: { userId: true },
      }),
      db.dailyReport.findMany({
        where: { userId: { in: memberIds }, date: { gte: windowStart, lt: today } },
        select: { userId: true, date: true },
      }),
      db.task.findMany({
        where: {
          assigneeId: { in: memberIds },
          status: { in: [...OPEN_TASK_STATUSES] },
        },
        orderBy: { updatedAt: "desc" },
        select: {
          assigneeId: true,
          title: true,
          status: true,
          dueDate: true,
          updatedAt: true,
        },
      }),
      db.task.count({
        where: {
          assigneeId: { in: memberIds },
          status: "COMPLETED",
          completedAt: { gte: istStartOfDay(weekStart) },
        },
      }),
    ]);

  const attMap = new Map(todayAtt.map((a) => [a.userId, a]));
  const planMap = new Map(plansToday.map((p) => [p.userId, p.priorities]));
  const reportedToday = new Set(reportsToday.map((r) => r.userId));

  // Most recently updated IN_PROGRESS task per member (openTasks is sorted desc).
  const currentTask = new Map<string, string>();
  for (const t of openTasks) {
    if (t.status === "IN_PROGRESS" && !currentTask.has(t.assigneeId)) {
      currentTask.set(t.assigneeId, t.title);
    }
  }

  const presentToday = todayAtt.filter((a) =>
    (PRESENT_STATUSES as readonly string[]).includes(a.status),
  ).length;
  const lateToday = todayAtt.filter((a) => a.status === "LATE").length;
  const onLeaveToday = todayAtt.filter((a) => a.status === "LEAVE").length;
  const inProgressCount = openTasks.filter((t) => t.status === "IN_PROGRESS").length;
  const blockedCount = openTasks.filter((t) => t.status === "BLOCKED").length;

  // ---- Needs attention (last 14 days) --------------------------------------
  const pastWorkingDays = listDates(windowStart, today).filter(
    (d) => d < today && dayKind(d, policy, holidayMap) === "WORKING",
  );
  const histByUser = new Map<string, Map<string, string>>();
  for (const a of histAtt) {
    if (a.date < windowStart) continue;
    let m = histByUser.get(a.userId);
    if (!m) histByUser.set(a.userId, (m = new Map()));
    m.set(a.date, a.status);
  }
  const reportDaysByUser = new Map<string, Set<string>>();
  for (const r of windowReports) {
    let s = reportDaysByUser.get(r.userId);
    if (!s) reportDaysByUser.set(r.userId, (s = new Set()));
    s.add(r.date);
  }

  const attention = members
    .map((member) => {
      const days = histByUser.get(member.id);
      const reported = reportDaysByUser.get(member.id);
      let absences = 0;
      let lates = 0;
      let silentDays = 0;
      for (const d of pastWorkingDays) {
        const status = days?.get(d);
        if (!status || status === "ABSENT") absences++;
        else if (status === "LATE") lates++;
        if (
          status &&
          (PRESENT_STATUSES as readonly string[]).includes(status) &&
          !reported?.has(d)
        ) {
          silentDays++;
        }
      }
      if (attMap.get(member.id)?.status === "LATE") lates++;

      const overdue = openTasks.filter(
        (t) => t.assigneeId === member.id && t.dueDate != null && t.dueDate < today,
      ).length;
      const staleBlocked = openTasks.some(
        (t) =>
          t.assigneeId === member.id &&
          t.status === "BLOCKED" &&
          now.getTime() - t.updatedAt.getTime() > STALE_BLOCKED_MS,
      );

      const flags: Flag[] = [];
      if (absences >= 2) flags.push({ label: plural(absences, "absence"), tone: "bad" });
      if (lates >= 3) flags.push({ label: `${lates} late arrivals`, tone: "warn" });
      if (silentDays >= 3)
        flags.push({ label: `${silentDays} days no report`, tone: "warn" });
      if (overdue >= 2)
        flags.push({ label: `${overdue} overdue tasks`, tone: "warn" });
      if (staleBlocked) flags.push({ label: "blocked 3d+", tone: "bad" });
      return { member, flags };
    })
    .filter((r) => r.flags.length > 0)
    .sort((a, b) => b.flags.length - a.flags.length);

  // ---- Attendance trend -----------------------------------------------------
  const presentByDay = new Map<string, Set<string>>();
  for (const a of histAtt) {
    if (!(PRESENT_STATUSES as readonly string[]).includes(a.status)) continue;
    let s = presentByDay.get(a.date);
    if (!s) presentByDay.set(a.date, (s = new Set()));
    s.add(a.userId);
  }
  const trend = trendDays.map((date) => ({
    date,
    rate: pct(presentByDay.get(date)?.size ?? 0, members.length),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="Team Overview"
        description={`${fmtDateLong(today)} · ${scopeLabel}`}
      />

      <div className="mb-6">
        <LinkTabs tabs={tabs} />
      </div>

      {/* Attendance stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Members"
          value={members.length}
          sub={selected ? selected.department : `across ${plural(teams.length, "team")}`}
        />
        <StatCard
          label="Present today"
          value={presentToday}
          sub={`${pct(presentToday, members.length)}% of team in`}
        />
        <StatCard label="On leave" value={onLeaveToday} sub="approved leave today" />
        <StatCard label="Late today" value={lateToday} sub="arrived after grace" />
      </div>

      {/* Task stats */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Open tasks"
          value={openTasks.length}
          sub={`${inProgressCount} in progress`}
        />
        <StatCard label="Completed this week" value={completedThisWeek} sub="since Monday" />
        <StatCard
          label="Blocked"
          value={blockedCount}
          tone="panel"
          sub={blockedCount > 0 ? "waiting on unblocking" : "nothing stuck"}
        />
      </div>

      {/* Roster */}
      <SectionTitle title="Roster" className="mt-10" />
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Member</Th>
              <Th>Status</Th>
              <Th>Clock-in</Th>
              <Th>Hours today</Th>
              <Th>Current work</Th>
              <Th className="text-center">Plan</Th>
              <Th className="text-center">Report</Th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const att = attMap.get(member.id) ?? null;
              const live = liveStatus(att);
              const worked = att ? workedMinutes(att, now) : 0;
              const work =
                currentTask.get(member.id) ??
                toLines(planMap.get(member.id))[0] ??
                null;
              return (
                <Tr key={member.id}>
                  <Td>
                    <Link
                      href={`/people/${member.id}`}
                      className="flex items-center gap-3 hover:opacity-80"
                    >
                      <Avatar name={member.name} hue={member.avatarHue} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {member.name}
                        </span>
                        <span className="block max-w-[180px] truncate text-xs text-ink-faint">
                          {member.title ?? ROLE_LABELS[member.role as Role]}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <StatusBadge status={live} />
                  </Td>
                  <Td className="text-sm tabular-nums text-ink-soft">
                    {fmtTime(att?.clockIn)}
                  </Td>
                  <Td className="text-sm tabular-nums text-ink-soft">
                    {att?.clockIn ? fmtDuration(worked) : "—"}
                  </Td>
                  <Td>
                    <span
                      className="block max-w-[240px] truncate text-sm text-ink-soft"
                      title={work ?? undefined}
                    >
                      {work ?? "—"}
                    </span>
                  </Td>
                  <Td className="text-center">
                    {planMap.has(member.id) ? (
                      <Check className="inline size-4 text-good" aria-label="Plan submitted" />
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </Td>
                  <Td className="text-center">
                    {reportedToday.has(member.id) ? (
                      <Check className="inline size-4 text-good" aria-label="Report submitted" />
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>

      {/* Attention + trend */}
      <div className="mt-8 grid gap-4 xl:grid-cols-5">
        <PanelCard className="xl:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <CardLabel className="text-panel-ink opacity-60">Needs attention</CardLabel>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-40">
              Last 14 days
            </span>
          </div>
          {attention.length === 0 ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-panel-line px-4 py-5">
              <ShieldCheck className="size-4 shrink-0 opacity-60" />
              <p className="text-sm opacity-70">
                All clear — no attention flags this fortnight.
              </p>
            </div>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-panel-line">
                {attention.slice(0, 6).map(({ member, flags }) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5"
                  >
                    <Link
                      href={`/people/${member.id}`}
                      className="flex min-w-0 items-center gap-2.5 hover:opacity-80"
                    >
                      <Avatar name={member.name} hue={member.avatarHue} size="sm" />
                      <span className="truncate text-sm font-medium">{member.name}</span>
                    </Link>
                    <span className="ml-auto flex flex-wrap justify-end gap-1.5">
                      {flags.map((flag) => (
                        <Badge key={flag.label} tone={flag.tone}>
                          {flag.label}
                        </Badge>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              {attention.length > 6 && (
                <p className="mt-3 text-xs opacity-50">
                  +{attention.length - 6} more with flags — narrow to a single team to see
                  everyone.
                </p>
              )}
            </>
          )}
        </PanelCard>

        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <CardLabel>Attendance trend</CardLabel>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              10 working days
            </span>
          </div>
          {trend.length === 0 ? (
            <p className="mt-6 text-sm text-ink-soft">No working days to chart yet.</p>
          ) : (
            <div className="mt-8 flex items-end gap-1.5 sm:gap-2">
              {trend.map((t) => (
                <div key={t.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-medium tabular-nums text-ink-faint">
                    {t.rate}%
                  </span>
                  <div className="flex h-24 w-full items-end justify-center">
                    <div
                      className={cn(
                        "w-2.5 rounded-full sm:w-3.5",
                        t.rate === 0
                          ? "bg-surface-2"
                          : t.date === today
                            ? "bg-accent"
                            : "bg-accent/60",
                      )}
                      style={{ height: `${Math.max(t.rate, 4)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px]",
                      t.date === today ? "font-medium text-ink" : "text-ink-faint",
                    )}
                  >
                    {t.date === today ? "Today" : fmtWeekday(t.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-5 border-t border-line pt-4 text-xs text-ink-soft">
            Share of members present (incl. late and half days) each working day.
          </p>
        </Card>
      </div>
    </>
  );
}
