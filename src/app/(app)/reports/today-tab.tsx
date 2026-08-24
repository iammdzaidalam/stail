import Link from "next/link";
import { NotebookPen, PencilLine } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { db } from "@/lib/db";
import { liveStatus, openBreak, workedMinutes } from "@/lib/attendance";
import type { CurrentUser } from "@/lib/session";
import {
  fmtDateLong,
  fmtDuration,
  fmtTime,
  minutesBetween,
  todayIST,
} from "@/lib/time";
import { toLines } from "@/lib/utils";
import { istDayRange } from "./lib";
import { ReportDocument } from "./report-document";
import { ReportForm } from "./report-form";

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tighter tabular-nums md:text-3xl">
        {value}
      </p>
    </div>
  );
}

export async function TodayTab({
  user,
  edit,
}: {
  user: CurrentUser;
  edit: boolean;
}) {
  const today = todayIST();
  const now = new Date();

  const [att, plan, report, completedToday, openTasks] = await Promise.all([
    db.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
      include: { breaks: true },
    }),
    db.dailyPlan.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    }),
    db.dailyReport.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    }),
    db.task.findMany({
      where: {
        assigneeId: user.id,
        status: "COMPLETED",
        completedAt: istDayRange(today),
      },
      orderBy: { completedAt: "asc" },
      select: { title: true },
    }),
    db.task.findMany({
      where: { assigneeId: user.id, status: { in: ["IN_PROGRESS", "BLOCKED"] } },
      orderBy: { updatedAt: "desc" },
      select: { title: true, status: true },
    }),
  ]);

  const planLines = toLines(plan?.priorities);
  const live = liveStatus(att);
  const worked = att ? workedMinutes(att, now) : 0;
  const open = att ? openBreak(att.breaks) : null;
  const breakMins = att
    ? att.breakMinutes +
      (open && !att.clockOut ? minutesBetween(open.startedAt, now) : 0)
    : 0;

  const defaults = {
    accomplishments:
      report?.accomplishments ??
      completedToday.map((t) => `- ${t.title}`).join("\n"),
    pending:
      report?.pending ??
      openTasks
        .map((t) => `- ${t.title}${t.status === "BLOCKED" ? " (blocked)" : ""}`)
        .join("\n"),
    blockers: report?.blockers ?? "",
    tomorrowPlan: report?.tomorrowPlan ?? "",
    notes: report?.notes ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Context strip: today's attendance + plan, written against ---- */}
      {!att && !plan ? (
        <EmptyState
          icon={<NotebookPen className="size-5" />}
          title="Nothing to report against yet"
          hint="You haven’t clocked in or set a daily plan today. Start your day from the dashboard — your report reads best against a plan."
          action={
            <Link href="/dashboard" className={buttonClass({ variant: "outline", size: "sm" })}>
              Go to dashboard
            </Link>
          }
        />
      ) : (
        <PanelCard className="p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardLabel className="text-panel-ink opacity-60">
                  End of day · {fmtDateLong(today)}
                </CardLabel>
                <span className="flex items-center gap-2">
                  {att && <StatusBadge status={att.mode} />}
                  <StatusBadge status={live} />
                </span>
              </div>
              {att?.clockIn ? (
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <HeroStat label="Clock-in" value={fmtTime(att.clockIn)} />
                  <HeroStat label="Worked" value={fmtDuration(worked)} />
                  <HeroStat label="Breaks" value={fmtDuration(breakMins)} />
                </div>
              ) : (
                <p className="mt-6 text-sm leading-relaxed opacity-60">
                  No clock-in recorded today.{" "}
                  <Link
                    href="/dashboard"
                    className="underline underline-offset-4 hover:opacity-80"
                  >
                    Head to the dashboard
                  </Link>{" "}
                  if you’re working.
                </p>
              )}
            </div>

            <div className="border-t border-panel-line pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <CardLabel className="text-panel-ink opacity-60">
                Today’s plan
              </CardLabel>
              {planLines.length > 0 ? (
                <ul className="mt-4 space-y-2.5">
                  {planLines.map((line, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed">
                      <span className="text-[11px] font-medium tabular-nums leading-[1.65rem] opacity-50">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-relaxed opacity-60">
                  No plan was submitted this morning.{" "}
                  <Link
                    href="/dashboard"
                    className="underline underline-offset-4 hover:opacity-80"
                  >
                    Set one from the dashboard
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
        </PanelCard>
      )}

      {/* ---- Report: finished document after submit, composer otherwise ---- */}
      {report ? (
        <div className="flex max-w-3xl flex-col gap-4">
          <ReportDocument
            name={user.name}
            report={report}
            attendance={
              att
                ? {
                    clockIn: att.clockIn,
                    clockOut: att.clockOut,
                    status: att.status,
                    minutes: att.clockIn ? worked : att.totalMinutes,
                  }
                : null
            }
          />
          {edit ? (
            <Card className="max-w-3xl p-6 md:p-8">
              <CardLabel>Edit today’s report</CardLabel>
              <p className="mt-1.5 mb-6 text-sm text-ink-soft">
                Update your entries below — the original submit time is kept.
              </p>
              <ReportForm defaults={defaults} mode="update" />
            </Card>
          ) : (
            <div>
              <Link
                href="/reports?tab=today&edit=1"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                <PencilLine className="size-3.5" />
                Edit report
              </Link>
            </div>
          )}
        </div>
      ) : (
        <Card className="max-w-3xl p-6 md:p-8">
          <CardLabel>End-of-day report</CardLabel>
          <p className="mt-1.5 mb-6 text-sm text-ink-soft">
            A couple of minutes now saves your lead an hour later. Write it
            against today’s plan.
          </p>
          <ReportForm defaults={defaults} mode="create" />
        </Card>
      )}
    </div>
  );
}
