import { CalendarCheck2, CalendarX2, Flame, NotebookPen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { StatCard } from "@/components/ui/stat";
import { dayKind, getHolidayMap, getPolicy } from "@/lib/attendance";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import { addDays, listDates, monthBounds, todayIST } from "@/lib/time";
import { plural } from "@/lib/utils";
import { ReportDocument } from "./report-document";

export async function HistoryTab({ user }: { user: CurrentUser }) {
  const today = todayIST();
  const lookbackStart = addDays(today, -90);

  const [policy, holidays, reports, recentDates, leaveRows] = await Promise.all([
    getPolicy(),
    getHolidayMap(),
    // Last 30 reports, newest first — rendered as document cards.
    db.dailyReport.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 30,
    }),
    // Report dates over the last 90 days — powers streak + month stats.
    db.dailyReport.findMany({
      where: { userId: user.id, date: { gte: lookbackStart, lte: today } },
      select: { date: true },
    }),
    // Days off on record (leave/holiday/weekend rows) don't break streaks.
    db.attendance.findMany({
      where: {
        userId: user.id,
        date: { gte: lookbackStart, lte: today },
        status: { in: ["LEAVE", "HOLIDAY", "WEEKEND"] },
      },
      select: { date: true },
    }),
  ]);

  const reportDates = new Set(recentDates.map((r) => r.date));
  const offDates = new Set(leaveRows.map((r) => r.date));

  // ---- Report streak: consecutive working days with a report, counting
  // back from today (or yesterday when today's report isn't in yet).
  let streak = 0;
  let cursor = reportDates.has(today) ? today : addDays(today, -1);
  while (cursor >= lookbackStart) {
    const kind = dayKind(cursor, policy, holidays);
    if (kind !== "WORKING" || offDates.has(cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!reportDates.has(cursor)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  // ---- This month: reports filed + missed working days so far.
  const { start: monthStart } = monthBounds(today);
  const monthDays = listDates(monthStart, today).filter(
    (d) => dayKind(d, policy, holidays) === "WORKING" && !offDates.has(d),
  );
  const reportsThisMonth = [...reportDates].filter((d) => d >= monthStart).length;
  const missed = monthDays.filter(
    (d) => !reportDates.has(d) && d !== today, // today isn't missed yet
  ).length;

  // Attendance rows for the listed reports' dates.
  const attRows = reports.length
    ? await db.attendance.findMany({
        where: { userId: user.id, date: { in: reports.map((r) => r.date) } },
      })
    : [];
  const attByDate = new Map(attRows.map((a) => [a.date, a]));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          tone="panel"
          label="Report streak"
          value={streak}
          sub={`consecutive working ${streak === 1 ? "day" : "days"} reported`}
          icon={<Flame className="size-4" />}
        />
        <StatCard
          label="Reports this month"
          value={reportsThisMonth}
          sub={`of ${plural(monthDays.length, "working day")} so far`}
          icon={<CalendarCheck2 className="size-4" />}
        />
        <StatCard
          label="Missed this month"
          value={missed}
          sub="working days without a report"
          icon={<CalendarX2 className="size-4" />}
        />
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="size-5" />}
          title="No reports yet"
          hint="Your submitted end-of-day reports will appear here, newest first."
        />
      ) : (
        <div className="flex max-w-3xl flex-col gap-5">
          {reports.map((report) => {
            const att = attByDate.get(report.date);
            return (
              <ReportDocument
                key={report.id}
                name={user.name}
                report={report}
                attendance={
                  att
                    ? {
                        clockIn: att.clockIn,
                        clockOut: att.clockOut,
                        status: att.status,
                        minutes: att.totalMinutes,
                      }
                    : null
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
