import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { StatCard } from "@/components/ui/stat";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import {
  attendanceRate,
  dayKind,
  getHolidayMap,
  getPolicy,
  workedMinutes,
} from "@/lib/attendance";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  addDays,
  fmtDateShort,
  fmtDuration,
  fmtTime,
  fmtWeekday,
  hmToMinutes,
  listDates,
  minutesToLabel,
  monthBounds,
  todayIST,
} from "@/lib/time";
import { cn, plural } from "@/lib/utils";

const CHART_SCALE_MINUTES = 10 * 60; // bars scale to a 10h day

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00Z`));
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayIST();
  const currentMonth = today.slice(0, 7);

  const raw = typeof sp.month === "string" ? sp.month : undefined;
  let month =
    raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : currentMonth;
  if (month > currentMonth) month = currentMonth; // never into the future

  const monthStart = `${month}-01`;
  const { end: monthEnd } = monthBounds(monthStart);
  const viewEnd = monthEnd < today ? monthEnd : today;
  const prevMonth = addDays(monthStart, -1).slice(0, 7);
  const nextMonth = addDays(monthEnd, 1).slice(0, 7);
  const canNext = month < currentMonth;

  const [policy, holidays] = await Promise.all([getPolicy(), getHolidayMap()]);

  // Last 10 working days (ending today) for the hours mini-chart.
  const chartDays: string[] = [];
  for (let d = today, i = 0; chartDays.length < 10 && i < 30; d = addDays(d, -1), i++) {
    if (dayKind(d, policy, holidays) === "WORKING") chartDays.unshift(d);
  }

  const [monthRows, chartRows, pendingCorrections] = await Promise.all([
    db.attendance.findMany({
      where: { userId: user.id, date: { gte: monthStart, lte: viewEnd } },
      include: { breaks: true },
    }),
    db.attendance.findMany({
      where: { userId: user.id, date: { in: chartDays } },
      include: { breaks: true },
    }),
    db.correctionRequest.findMany({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const byDate = new Map(monthRows.map((r) => [r.date, r]));
  const chartByDate = new Map(chartRows.map((r) => [r.date, r]));

  // ---- Month summary (elapsed days only) ---------------------------------
  const elapsed = listDates(monthStart, viewEnd);
  const workingDays = elapsed.filter(
    (d) => dayKind(d, policy, holidays) === "WORKING",
  ).length;
  const presentDays = monthRows.filter((r) =>
    ["PRESENT", "LATE", "HALF_DAY"].includes(r.status),
  ).length;
  const rate = attendanceRate(presentDays, workingDays);
  const completedRows = monthRows.filter(
    (r) => r.totalMinutes != null && r.totalMinutes > 0,
  );
  const avgMinutes =
    completedRows.length > 0
      ? Math.round(
          completedRows.reduce((s, r) => s + (r.totalMinutes ?? 0), 0) /
            completedRows.length,
        )
      : 0;
  const lateCount = monthRows.filter((r) => r.status === "LATE").length;
  const leaveCount = monthRows.filter((r) => r.status === "LEAVE").length;

  const chart = chartDays.map((date) => {
    const row = chartByDate.get(date);
    const minutes = row?.clockIn
      ? row.clockOut
        ? (row.totalMinutes ?? 0)
        : workedMinutes(row)
      : 0;
    return { date, minutes };
  });

  const days = [...elapsed].reverse(); // newest first

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        eyebrow="Workspace"
        title="My Attendance"
        description={`Clock-ins, hours and day statuses for ${monthLabel(month)}.`}
        actions={
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
            <Link
              href={`/attendance?month=${prevMonth}`}
              aria-label="Previous month"
              className={buttonClass({
                variant: "ghost",
                size: "icon",
                className: "size-8",
              })}
            >
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-28 px-1 text-center text-sm font-medium tabular-nums">
              {monthLabel(month)}
            </span>
            {canNext ? (
              <Link
                href={`/attendance?month=${nextMonth}`}
                aria-label="Next month"
                className={buttonClass({
                  variant: "ghost",
                  size: "icon",
                  className: "size-8",
                })}
              >
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span
                aria-hidden
                className={buttonClass({
                  variant: "ghost",
                  size: "icon",
                  className: "size-8 pointer-events-none opacity-30",
                })}
              >
                <ChevronRight className="size-4" />
              </span>
            )}
          </div>
        }
      />

      {/* Month summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        <StatCard
          tone="panel"
          label="Attendance"
          value={`${rate}%`}
          sub={`${presentDays} of ${plural(workingDays, "working day")}`}
        />
        <StatCard
          label="Avg hours"
          value={fmtDuration(avgMinutes)}
          sub="per completed day"
        />
        <StatCard
          label="Late arrivals"
          value={lateCount}
          sub={`after ${minutesToLabel(hmToMinutes(policy.workStart) + policy.graceMinutes)} grace`}
        />
        <StatCard
          label="Leave days"
          value={leaveCount}
          sub="this month"
        />
      </div>

      {/* Hours chart + pending corrections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <CardLabel>Hours — last 10 working days</CardLabel>
            <span className="text-[11px] tabular-nums text-ink-faint">
              scale 10h
            </span>
          </div>
          {chart.length === 0 ? (
            <p className="mt-6 text-sm text-ink-faint">No working days yet.</p>
          ) : (
            <div className="mt-6 flex items-end gap-1.5 sm:gap-3">
              {chart.map((c) => (
                <div
                  key={c.date}
                  title={`${fmtDateShort(c.date)} — ${
                    c.minutes > 0 ? fmtDuration(c.minutes) : "No hours logged"
                  }`}
                  className="flex min-w-0 flex-1 flex-col items-center gap-2"
                >
                  <span className="text-[9px] tabular-nums text-ink-faint">
                    {c.minutes > 0 ? fmtDuration(c.minutes) : "—"}
                  </span>
                  <div className="flex h-28 w-full items-end">
                    <div
                      className={cn(
                        "mx-auto w-full max-w-9 rounded-md transition",
                        c.minutes > 0
                          ? "bg-accent hover:brightness-95"
                          : "bg-surface-2",
                      )}
                      style={{
                        height:
                          c.minutes > 0
                            ? `${Math.max(4, Math.min(100, (c.minutes / CHART_SCALE_MINUTES) * 100))}%`
                            : "3px",
                      }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wide",
                      c.date === today
                        ? "font-semibold text-ink"
                        : "text-ink-faint",
                    )}
                  >
                    {fmtWeekday(c.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <CardLabel>Correction Requests</CardLabel>
            {pendingCorrections.length > 0 && (
              <StatusBadge status="PENDING" />
            )}
          </div>
          {pendingCorrections.length === 0 ? (
            <p className="mt-4 text-sm text-ink-faint">
              No pending correction requests. Spot something wrong in a past
              day? Use “Request correction” on that row.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {pendingCorrections.map((c) => (
                <li
                  key={c.id}
                  className="rounded-2xl border border-line bg-surface-2/40 px-3.5 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium tabular-nums">
                      {fmtDateShort(c.date)}
                    </p>
                    <span className="text-[11px] text-ink-faint">
                      awaiting review
                    </span>
                  </div>
                  {(c.requestedClockIn || c.requestedClockOut) && (
                    <p className="mt-1 text-xs tabular-nums text-ink-soft">
                      {c.requestedClockIn &&
                        `In ${minutesToLabel(hmToMinutes(c.requestedClockIn))}`}
                      {c.requestedClockIn && c.requestedClockOut && " · "}
                      {c.requestedClockOut &&
                        `Out ${minutesToLabel(hmToMinutes(c.requestedClockOut))}`}
                    </p>
                  )}
                  <p className="mt-1 line-clamp-2 text-xs text-ink-faint">
                    {c.reason}
                  </p>
                  <Link
                    href="/leave?tab=corrections"
                    className="mt-1.5 inline-block text-[11px] font-medium text-ink-soft underline-offset-2 hover:underline"
                  >
                    View full request
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Day log */}
      {days.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-5" />}
          title="Nothing to show yet"
          hint="This month hasn’t started."
        />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>Clock in</Th>
                <Th>Clock out</Th>
                <Th>Break</Th>
                <Th>Total</Th>
                <Th>Summary</Th>
                <Th className="text-right" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {days.map((date) => {
                const att = byDate.get(date);
                const kind = dayKind(date, policy, holidays);
                const isToday = date === today;
                const offDay =
                  kind !== "WORKING" ||
                  att?.status === "WEEKEND" ||
                  att?.status === "HOLIDAY";
                const missedPast = !att && kind === "WORKING" && !isToday;
                // Live "so far" totals only make sense for today; a past day
                // missing its clock-out just has no total.
                const liveTotal =
                  isToday && att?.clockIn && !att.clockOut
                    ? workedMinutes(att)
                    : null;

                return (
                  <Tr key={date} className={cn(offDay && "opacity-60")}>
                    <Td>
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium tabular-nums">
                          {fmtDateShort(date)}
                        </span>
                        <span className="text-xs text-ink-faint">
                          {isToday ? "Today" : fmtWeekday(date)}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        {att ? (
                          <StatusBadge status={att.status} />
                        ) : missedPast ? (
                          <span className="text-[11px] font-medium uppercase tracking-wide text-bad/70">
                            Absent
                          </span>
                        ) : kind === "WORKING" ? (
                          <StatusBadge status="NOT_IN" />
                        ) : (
                          <StatusBadge
                            status={kind === "HOLIDAY" ? "HOLIDAY" : "WEEKEND"}
                          />
                        )}
                        {att?.mode === "REMOTE" && att.clockIn && (
                          <StatusBadge status="REMOTE" />
                        )}
                      </div>
                    </Td>
                    <Td className="tabular-nums">{fmtTime(att?.clockIn)}</Td>
                    <Td className="tabular-nums">{fmtTime(att?.clockOut)}</Td>
                    <Td className="tabular-nums">
                      {att && att.breakMinutes > 0
                        ? fmtDuration(att.breakMinutes)
                        : "—"}
                    </Td>
                    <Td className="tabular-nums">
                      {liveTotal != null ? (
                        <span>
                          {fmtDuration(liveTotal)}
                          <span className="ml-1 text-[11px] text-ink-faint">
                            so far
                          </span>
                        </span>
                      ) : att?.totalMinutes != null ? (
                        fmtDuration(att.totalMinutes)
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <span className="block max-w-72 whitespace-normal break-words text-xs leading-relaxed text-ink-soft">
                        {att?.workSummary ??
                          (kind === "HOLIDAY" ? holidays.get(date) : "—")}
                      </span>
                    </Td>
                    <Td className="text-right">
                      {kind === "WORKING" &&
                        !isToday &&
                        date >= addDays(today, -30) && (
                        <Link
                          href={`/leave?tab=corrections&date=${date}`}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink-faint transition hover:text-ink"
                        >
                          <Pencil className="size-3" />
                          Request correction
                        </Link>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
