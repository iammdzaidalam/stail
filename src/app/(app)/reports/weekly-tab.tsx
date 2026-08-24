import Link from "next/link";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { StatCard } from "@/components/ui/stat";
import { dayKind, getHolidayMap, getPolicy, workedMinutes } from "@/lib/attendance";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import {
  addDays,
  fmtDateFull,
  fmtDateShort,
  fmtDuration,
  listDates,
  todayIST,
  weekBounds,
} from "@/lib/time";
import { pct, plural, toLines } from "@/lib/utils";
import { istDayRange, projectColor } from "./lib";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function WeeklyTab({
  user,
  week,
}: {
  user: CurrentUser;
  week?: string;
}) {
  const today = todayIST();
  const current = weekBounds(today);

  // ?week= accepts any date inside the target week; never a future week.
  const anchor = week && DATE_KEY_RE.test(week) ? week : today;
  let { start, end } = weekBounds(anchor);
  if (start > current.start) ({ start, end } = current);
  const isCurrent = start === current.start;

  const nextWeekStart = addDays(end, 1);
  const nextWeekEnd = addDays(end, 7);

  const [policy, holidays, attRows, reports, distTasks, dueNextWeek] =
    await Promise.all([
      getPolicy(),
      getHolidayMap(),
      db.attendance.findMany({
        where: { userId: user.id, date: { gte: start, lte: end } },
        include: { breaks: true },
      }),
      db.dailyReport.findMany({
        where: { userId: user.id, date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
      }),
      // Tasks I completed OR touched during the week, for project distribution.
      db.task.findMany({
        where: {
          assigneeId: user.id,
          OR: [
            { completedAt: istDayRange(start, end) },
            { updatedAt: istDayRange(start, end) },
          ],
        },
        select: {
          status: true,
          completedAt: true,
          project: { select: { id: true, name: true, hue: true } },
        },
      }),
      db.task.findMany({
        where: {
          assigneeId: user.id,
          status: { notIn: ["COMPLETED"] },
          dueDate: { gte: nextWeekStart, lte: nextWeekEnd },
        },
        orderBy: { dueDate: "asc" },
        take: 8,
        select: { id: true, title: true, status: true, dueDate: true },
      }),
    ]);

  // ---- Stats -------------------------------------------------------------
  const weekDays = listDates(start, end);
  const workingDays = weekDays.filter(
    (d) => dayKind(d, policy, holidays) === "WORKING",
  );
  const elapsedWorking = workingDays.filter((d) => d <= today).length;

  const presentRows = attRows.filter((a) => a.clockIn != null);
  const daysPresent = presentRows.length;
  // Final totalMinutes when available; live workedMinutes only for today.
  const totalWorked = presentRows.reduce(
    (sum, a) =>
      sum + (a.totalMinutes ?? (a.date === today ? workedMinutes(a) : 0)),
    0,
  );
  const avgMinutes = daysPresent > 0 ? Math.round(totalWorked / daysPresent) : 0;

  const weekRange = istDayRange(start, end);
  const tasksCompleted = distTasks.filter(
    (t) =>
      t.status === "COMPLETED" &&
      t.completedAt != null &&
      t.completedAt >= weekRange.gte &&
      t.completedAt < weekRange.lt,
  ).length;
  const reportingRate =
    elapsedWorking > 0 ? Math.min(100, pct(reports.length, elapsedWorking)) : 0;

  // ---- Project distribution ---------------------------------------------
  const groups = new Map<
    string,
    { name: string; hue: number | null; count: number }
  >();
  for (const t of distTasks) {
    const key = t.project?.id ?? "none";
    const g = groups.get(key) ?? {
      name: t.project?.name ?? "No project",
      hue: t.project?.hue ?? null,
      count: 0,
    };
    g.count += 1;
    groups.set(key, g);
  }
  const dist = [...groups.entries()]
    .map(([key, g]) => ({ key, ...g, color: projectColor(g.hue) }))
    .sort((a, b) => b.count - a.count);
  const distTotal = dist.reduce((s, g) => s + g.count, 0);
  const topProject = dist.find((g) => g.key !== "none")?.name;

  // ---- Narrative sections ------------------------------------------------
  const achievements = reports
    .flatMap((r) => toLines(r.accomplishments))
    .slice(0, 8);
  const blockers = [
    ...new Set(reports.flatMap((r) => toLines(r.blockers))),
  ].slice(0, 8);
  const latestTomorrow =
    [...reports].reverse().find((r) => toLines(r.tomorrowPlan).length > 0) ??
    null;
  const plannedLines = toLines(latestTomorrow?.tomorrowPlan).slice(0, 8);

  const hasAnyData =
    reports.length > 0 || attRows.length > 0 || distTasks.length > 0;

  const summary = hasAnyData
    ? `Present ${daysPresent} of ${plural(elapsedWorking, "working day")}, ` +
      `${plural(tasksCompleted, "task")} completed` +
      (topProject ? ` — mostly on ${topProject}` : "") +
      `, ${plural(reports.length, "daily report")} filed.`
    : "No activity recorded for this week.";

  const navBtn = buttonClass({
    variant: "outline",
    size: "icon",
    className:
      "size-9 border-panel-line text-panel-ink hover:bg-panel-ink/10 hover:text-panel-ink",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Hero: the auto-generated weekly report header ---- */}
      <PanelCard className="p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardLabel className="text-panel-ink opacity-60">
              Weekly Report{isCurrent ? " · This week" : ""}
            </CardLabel>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight md:text-2xl">
              {user.name}
            </h2>
            <p className="mt-1 text-xs opacity-60">
              {fmtDateShort(start)} – {fmtDateFull(end)}
              {user.team ? ` · ${user.team.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/reports?tab=weekly&week=${addDays(start, -7)}`}
              aria-label="Previous week"
              className={navBtn}
            >
              <ChevronLeft className="size-4" />
            </Link>
            {isCurrent ? (
              <span aria-hidden className={`${navBtn} pointer-events-none opacity-40`}>
                <ChevronRight className="size-4" />
              </span>
            ) : (
              <Link
                href={`/reports?tab=weekly&week=${addDays(start, 7)}`}
                aria-label="Next week"
                className={navBtn}
              >
                <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        </div>
        <p className="mt-6 max-w-2xl border-t border-panel-line pt-5 text-sm leading-relaxed opacity-80">
          {summary}
        </p>
      </PanelCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Days present"
          value={daysPresent}
          sub={`of ${plural(workingDays.length, "working day")}`}
        />
        <StatCard
          label="Avg working hours"
          value={daysPresent > 0 ? fmtDuration(avgMinutes) : "—"}
          sub="per present day"
        />
        <StatCard
          label="Tasks completed"
          value={tasksCompleted}
          sub="completed this week"
        />
        <StatCard
          label="Reporting rate"
          value={elapsedWorking > 0 ? `${reportingRate}%` : "—"}
          sub={`${reports.length} of ${plural(elapsedWorking, "working day")}`}
        />
      </div>

      {!hasAnyData ? (
        <EmptyState
          icon={<CalendarClock className="size-5" />}
          title="A quiet week"
          hint="No attendance, tasks, or reports were recorded in this week."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ---- Project distribution ---- */}
          <Card className="p-6">
            <CardLabel>Project distribution</CardLabel>
            <p className="mt-1.5 text-sm text-ink-soft">
              {plural(distTotal, "task")} worked across{" "}
              {plural(dist.length, "project")}
            </p>
            {dist.length === 0 ? (
              <p className="mt-5 text-sm text-ink-faint">
                No task activity recorded this week.
              </p>
            ) : (
              <>
                <div className="mt-5 flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
                  {dist.map((g) => (
                    <div
                      key={g.key}
                      title={`${g.name} — ${plural(g.count, "task")}`}
                      className="h-full rounded-full"
                      style={{
                        width: `${(g.count / distTotal) * 100}%`,
                        backgroundColor: g.color,
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-5 space-y-2.5">
                  {dist.map((g) => (
                    <li
                      key={g.key}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: g.color }}
                          aria-hidden
                        />
                        <span className="truncate">{g.name}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                        {g.count} · {pct(g.count, distTotal)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* ---- Key achievements ---- */}
          <Card className="p-6">
            <CardLabel>Key achievements</CardLabel>
            <p className="mt-1.5 text-sm text-ink-soft">
              Highlights from the week’s daily reports
            </p>
            {achievements.length === 0 ? (
              <p className="mt-5 text-sm text-ink-faint">
                No accomplishments were reported this week.
              </p>
            ) : (
              <ul className="mt-5 space-y-2.5">
                {achievements.map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 text-sm leading-relaxed text-ink"
                  >
                    <Check className="mt-0.5 size-3.5 shrink-0 text-good" />
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ---- Blockers ---- */}
          <Card className="p-6">
            <CardLabel>Blockers</CardLabel>
            <p className="mt-1.5 text-sm text-ink-soft">
              Everything that got in the way
            </p>
            {blockers.length === 0 ? (
              <p className="mt-5 text-sm text-ink-faint">
                No blockers reported — a clean week.
              </p>
            ) : (
              <ul className="mt-5 space-y-2.5">
                {blockers.map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 text-sm leading-relaxed text-ink"
                  >
                    <span
                      className="mt-[8px] size-1 shrink-0 rounded-full bg-bad"
                      aria-hidden
                    />
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ---- Next week ---- */}
          <Card className="p-6">
            <CardLabel>Next week</CardLabel>
            <p className="mt-1.5 text-sm text-ink-soft">
              Open tasks due {fmtDateShort(nextWeekStart)} –{" "}
              {fmtDateShort(nextWeekEnd)} and the latest plan
            </p>
            {dueNextWeek.length === 0 && plannedLines.length === 0 ? (
              <p className="mt-5 text-sm text-ink-faint">
                Nothing scheduled for next week yet.
              </p>
            ) : (
              <div className="mt-5 space-y-5">
                {dueNextWeek.length > 0 && (
                  <ul className="space-y-2.5">
                    {dueNextWeek.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0 truncate text-sm">{t.title}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={t.status} />
                          <span className="text-xs tabular-nums text-ink-faint">
                            {t.dueDate ? fmtDateShort(t.dueDate) : "—"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {plannedLines.length > 0 && (
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                      <Sparkles className="size-3" />
                      Planned{latestTomorrow ? ` · ${fmtDateShort(latestTomorrow.date)} report` : ""}
                    </p>
                    <ul className="mt-2.5 space-y-2">
                      {plannedLines.map((line, i) => (
                        <li
                          key={i}
                          className="flex gap-2.5 text-sm leading-relaxed text-ink"
                        >
                          <span
                            className="mt-[8px] size-1 shrink-0 rounded-full bg-ink-faint"
                            aria-hidden
                          />
                          <span className="min-w-0">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
