import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  CircleCheck,
  Clock3,
  Flame,
  ListChecks,
  Megaphone,
  NotebookPen,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import {
  dayKind,
  getHolidayMap,
  getPolicy,
  liveStatus,
  workedMinutes,
} from "@/lib/attendance";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  addDays,
  fmtDateLong,
  fmtDateShort,
  fmtDuration,
  fmtTime,
  hmToMinutes,
  istMinutesOfDay,
  minutesToLabel,
  timeAgo,
  todayIST,
  weekBounds,
} from "@/lib/time";
import { cn, plural, toLines } from "@/lib/utils";
import { submitPlan } from "./actions";
import { ClockCard } from "./clock-card";

const PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayIST();
  const lookback = addDays(today, -70);
  const { start: weekStart } = weekBounds(today);

  // UTC window covering today's IST calendar day (for completedAt timestamps).
  const [y, m, d] = today.split("-").map(Number);
  const dayStartUtc = new Date(Date.UTC(y, m - 1, d, 0, 0) - 330 * 60000);
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60000);

  const [
    policy,
    holidays,
    attToday,
    recentAtt,
    plan,
    reports,
    tasks,
    doneToday,
    announcements,
  ] = await Promise.all([
    getPolicy(),
    getHolidayMap(),
    db.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
      include: { breaks: true },
    }),
    db.attendance.findMany({
      where: { userId: user.id, date: { gte: lookback, lt: today } },
      select: { date: true, status: true, totalMinutes: true },
    }),
    db.dailyPlan.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    }),
    db.dailyReport.findMany({
      where: { userId: user.id, date: { gte: lookback, lte: today } },
      select: { date: true, submittedAt: true },
    }),
    db.task.findMany({
      where: {
        assigneeId: user.id,
        OR: [
          { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW"] } },
          { dueDate: today },
        ],
      },
      include: { project: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.task.count({
      where: {
        assigneeId: user.id,
        status: "COMPLETED",
        completedAt: { gte: dayStartUtc, lt: dayEndUtc },
      },
    }),
    db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 2 }),
  ]);

  const kind = dayKind(today, policy, holidays);
  const live = liveStatus(attToday);
  const nowIst = istMinutesOfDay(new Date());
  const firstName = user.name.trim().split(/\s+/)[0];
  const greeting =
    nowIst < 12 * 60
      ? "Good morning"
      : nowIst < 17 * 60
        ? "Good afternoon"
        : "Good evening";
  const dayNote =
    kind === "HOLIDAY"
      ? `Today is a holiday — ${holidays.get(today)}.`
      : kind === "WEEKEND"
        ? "It’s the weekend — no attendance expected."
        : "Here’s where your day stands.";

  // ---- Stats -------------------------------------------------------------
  const attMap = new Map(recentAtt.map((r) => [r.date, r]));
  const weekMinutes =
    recentAtt
      .filter((r) => r.date >= weekStart)
      .reduce((sum, r) => sum + (r.totalMinutes ?? 0), 0) +
    (attToday ? workedMinutes(attToday) : 0);

  // A day that doesn't count for or against streaks.
  const skippable = (date: string): boolean => {
    const status = attMap.get(date)?.status;
    return (
      dayKind(date, policy, holidays) !== "WORKING" ||
      status === "LEAVE" ||
      status === "WEEKEND" ||
      status === "HOLIDAY"
    );
  };

  // Consecutive past working days present (PRESENT/LATE), back from yesterday.
  let attendanceStreak = 0;
  for (let cursor = addDays(today, -1), i = 0; i < 70; cursor = addDays(cursor, -1), i++) {
    if (skippable(cursor)) continue;
    const status = attMap.get(cursor)?.status;
    if (status === "PRESENT" || status === "LATE") attendanceStreak++;
    else break;
  }

  // Consecutive working days with a submitted daily report.
  const reportDates = new Set(reports.map((r) => r.date));
  const todayReport = reports.find((r) => r.date === today) ?? null;
  let reportStreak = 0;
  for (
    let cursor = todayReport ? today : addDays(today, -1), i = 0;
    i < 70;
    cursor = addDays(cursor, -1), i++
  ) {
    if (cursor !== today && skippable(cursor)) continue;
    if (reportDates.has(cursor)) reportStreak++;
    else break;
  }

  // ---- Tasks -------------------------------------------------------------
  const taskList = [...tasks]
    .sort((a, b) => {
      const dueA = a.dueDate === today ? 0 : 1;
      const dueB = b.dueDate === today ? 0 : 1;
      if (dueA !== dueB) return dueA - dueB;
      const pa = PRIORITY_RANK[a.priority] ?? 4;
      const pb = PRIORITY_RANK[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, 6);
  const openToday = tasks.filter((t) =>
    ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW"].includes(t.status),
  ).length;

  const showNudge =
    kind === "WORKING" &&
    live === "NOT_IN" &&
    nowIst > hmToMinutes(policy.workStart);
  const reportAttention =
    !todayReport && kind === "WORKING" && nowIst >= 18 * 60;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        eyebrow={fmtDateLong(today)}
        title={`${greeting}, ${firstName}`}
        description={dayNote}
      />

      {showNudge && (
        <div className="flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm">
          <AlarmClock className="size-4 shrink-0 text-warn" />
          <span>
            You haven’t clocked in yet — your workday starts at{" "}
            {minutesToLabel(hmToMinutes(policy.workStart))}.
          </span>
        </div>
      )}

      {/* Hero + right rail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ClockCard
            att={attToday}
            policy={policy}
            kind={kind}
            holidayName={holidays.get(today) ?? null}
          />
        </div>

        <div className="flex flex-col gap-6">
          {/* Daily report */}
          <Card
            className={cn(
              "flex flex-1 flex-col justify-between gap-5",
              reportAttention && "border-warn/50",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <CardLabel>Daily Report</CardLabel>
              {todayReport ? (
                <Badge tone="good" dot>
                  Submitted
                </Badge>
              ) : reportAttention ? (
                <Badge tone="warn" dot>
                  Due
                </Badge>
              ) : null}
            </div>
            {todayReport ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-good/15 text-good">
                    <CircleCheck className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      Today’s report is in
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      Submitted at {fmtTime(todayReport.submittedAt)}
                    </p>
                  </div>
                </div>
                <Link
                  href="/reports"
                  className={buttonClass({ variant: "outline", size: "sm" })}
                >
                  View report <ArrowRight className="size-3.5" />
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  {reportAttention
                    ? "It’s past 6 PM and today’s report hasn’t been filed yet."
                    : "You haven’t submitted today’s report."}{" "}
                  Complete it before you clock out.
                </p>
                <Link href="/reports" className={buttonClass({ size: "sm" })}>
                  Write today’s report <ArrowRight className="size-3.5" />
                </Link>
              </>
            )}
          </Card>

          {/* Announcements */}
          <Card>
            <div className="flex items-baseline justify-between gap-3">
              <CardLabel>Announcements</CardLabel>
              <Link
                href="/announcements"
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft transition hover:text-ink"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            </div>
            {announcements.length === 0 ? (
              <p className="mt-4 text-sm text-ink-faint">
                Nothing new right now.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-1">
                {announcements.map((a) => (
                  <li key={a.id}>
                    <Link
                      href="/announcements"
                      className="-mx-2 flex gap-3 rounded-2xl px-2 py-2 transition hover:bg-surface-2/60"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
                        <Megaphone className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-medium">
                            {a.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-ink-faint">
                            {timeAgo(a.createdAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-soft">
                          {a.body}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        <StatCard
          label="Today’s tasks"
          value={openToday}
          sub={`open · ${plural(doneToday, "task")} done today`}
          icon={<ListChecks className="size-4" />}
        />
        <StatCard
          label="This week"
          value={fmtDuration(weekMinutes)}
          sub="hours logged, incl. today"
          icon={<Clock3 className="size-4" />}
        />
        <StatCard
          label="Attendance streak"
          value={attendanceStreak}
          sub={`${plural(attendanceStreak, "working day")} present in a row`}
          icon={<Flame className="size-4" />}
        />
        <StatCard
          label="Report streak"
          value={reportStreak}
          sub={`${plural(reportStreak, "daily report")} in a row`}
          icon={<NotebookPen className="size-4" />}
        />
      </div>

      {/* Plan + tasks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <CardLabel>Today’s Plan</CardLabel>
            {plan && (
              <span className="text-[11px] text-ink-faint">
                Submitted {fmtTime(plan.submittedAt)}
              </span>
            )}
          </div>
          {plan ? (
            <>
              <ul className="mt-4 flex flex-col gap-2.5">
                {toLines(plan.priorities).map((line, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold tabular-nums text-ink-soft">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{line}</span>
                  </li>
                ))}
              </ul>
              {plan.deliverables && (
                <div className="mt-5 border-t border-line pt-4">
                  <CardLabel>Deliverables</CardLabel>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    {plan.deliverables}
                  </p>
                </div>
              )}
            </>
          ) : (
            <form action={submitPlan} className="mt-4 flex flex-1 flex-col gap-4">
              <Field
                label="Top priorities"
                htmlFor="plan-priorities"
                hint="One per line — what does a good day look like?"
              >
                <Textarea
                  id="plan-priorities"
                  name="priorities"
                  required
                  maxLength={2000}
                  placeholder={"Finish API error handling\nReview design handoff\nPrep sprint demo"}
                />
              </Field>
              <Field label="Deliverables" htmlFor="plan-deliverables" hint="Optional">
                <Input
                  id="plan-deliverables"
                  name="deliverables"
                  maxLength={2000}
                  placeholder="Demo build, spec doc…"
                />
              </Field>
              <Button type="submit" size="sm" className="self-start">
                Submit plan
              </Button>
            </form>
          )}
        </Card>

        <Card className="flex flex-col lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <CardLabel>Today’s Tasks</CardLabel>
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft transition hover:text-ink"
            >
              All tasks <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {taskList.length === 0 ? (
            <EmptyState
              className="mt-4 flex-1 border-0 py-10"
              icon={<ListChecks className="size-5" />}
              title="No open tasks"
              hint="Nothing due today and nothing in progress. Check the backlog on your tasks page."
            />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {taskList.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3"
                >
                  <div className="min-w-0 flex-1 basis-52">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="block truncate text-sm font-medium transition hover:underline"
                    >
                      {t.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {t.project?.name ?? "No project"}
                      {t.dueDate &&
                        (t.dueDate === today
                          ? " · due today"
                          : ` · due ${fmtDateShort(t.dueDate)}`)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StatusBadge status={t.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
