import { Coffee, LogIn, LogOut, TreePalm, TriangleAlert } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import {
  liveStatus,
  openBreak,
  workedMinutes,
  type DayKind,
} from "@/lib/attendance";
import type { LiveStatus } from "@/lib/definitions";
import {
  fmtDuration,
  fmtTime,
  hmToMinutes,
  istMinutesOfDay,
  minutesToLabel,
} from "@/lib/time";
import { clockIn, clockOut, endBreak, startBreak } from "./actions";
import { LiveDuration } from "./live-duration";

type BreakRow = { id: string; startedAt: Date; endedAt: Date | null };
type AttRow = {
  clockIn: Date | null;
  clockOut: Date | null;
  status: string;
  mode: string;
  breakMinutes: number;
  totalMinutes: number | null;
  workSummary: string | null;
  breaks: BreakRow[];
};
type PolicyLike = {
  workStart: string;
  workEnd: string;
  graceMinutes: number;
  fullDayHours: number;
};

/** Secondary button styling that sits correctly on the dark panel. */
const panelBtn = "border-panel-line text-panel-ink hover:bg-panel-ink/10";
/** Input styling that sits correctly on the dark panel. */
const panelInput =
  "border-panel-line bg-panel-ink/5 text-panel-ink placeholder:text-panel-soft focus:border-panel-line focus:ring-accent/30";

function Micro({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-60">
      {children}
    </p>
  );
}

function LiveBadge({ live }: { live: LiveStatus }) {
  if (live === "NOT_IN" || live === "ABSENT") {
    return (
      <Badge tone="outline" className="border-panel-line text-panel-ink/80">
        Not Started
      </Badge>
    );
  }
  if (live === "LEAVE") return <StatusBadge status="LEAVE" />;
  return <StatusBadge status={live} />;
}

/**
 * The dashboard hero: today's live clock state with one-tap actions.
 * Server component — durations are computed server-side, no client ticking.
 */
export function ClockCard({
  att,
  policy,
  kind,
  holidayName,
}: {
  att: AttRow | null;
  policy: PolicyLike;
  kind: DayKind;
  holidayName: string | null;
}) {
  const live = liveStatus(att);
  const worked = att ? workedMinutes(att) : 0;
  const graceEnd = hmToMinutes(policy.workStart) + policy.graceMinutes;
  const nowIst = istMinutesOfDay(new Date());
  const open = openBreak(att?.breaks);

  return (
    <PanelCard className="flex h-full flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Micro>Time clock</Micro>
          <p className="mt-1.5 text-sm opacity-70">
            Shift {minutesToLabel(hmToMinutes(policy.workStart))} –{" "}
            {minutesToLabel(hmToMinutes(policy.workEnd))} IST
          </p>
        </div>
        <div className="flex items-center gap-2">
          {att?.status === "LATE" && live !== "CLOCKED_OUT" && (
            <StatusBadge status="LATE" />
          )}
          <LiveBadge live={live} />
        </div>
      </div>

      {live === "LEAVE" ? (
        <div className="flex flex-1 flex-col items-start justify-end gap-4">
          <TreePalm className="size-6 opacity-50" />
          <div>
            <p className="text-2xl font-semibold tracking-tight md:text-3xl">
              On leave today
            </p>
            <p className="mt-1.5 max-w-md text-sm opacity-60">
              Your approved leave is on record — no clock-in needed. Enjoy the
              time off.
            </p>
          </div>
        </div>
      ) : live === "CLOCKED_OUT" && att ? (
        <div className="flex flex-1 flex-col justify-end gap-6">
          <div>
            <Micro>Total today</Micro>
            <p className="mt-1 text-4xl font-semibold tracking-tighter tabular-nums md:text-5xl">
              {fmtDuration(att.totalMinutes ?? worked)}
            </p>
            <p className="mt-2 text-sm opacity-70">
              That’s a wrap — see you tomorrow.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-panel-line pt-5 sm:grid-cols-4">
            <div>
              <Micro>Clock in</Micro>
              <p className="mt-1.5 text-sm font-medium tabular-nums">
                {fmtTime(att.clockIn)}
              </p>
            </div>
            <div>
              <Micro>Clock out</Micro>
              <p className="mt-1.5 text-sm font-medium tabular-nums">
                {fmtTime(att.clockOut)}
              </p>
            </div>
            <div>
              <Micro>Breaks</Micro>
              <p className="mt-1.5 text-sm font-medium tabular-nums">
                {att.breakMinutes > 0 ? fmtDuration(att.breakMinutes) : "—"}
              </p>
            </div>
            <div>
              <Micro>Day status</Micro>
              <div className="mt-1.5">
                <StatusBadge status={att.status} />
              </div>
            </div>
          </div>
          {att.workSummary && (
            <p className="rounded-2xl bg-panel-ink/5 px-4 py-3 text-sm leading-relaxed opacity-80">
              {att.workSummary}
            </p>
          )}
        </div>
      ) : live === "WORKING" || live === "BREAK" ? (
        <div className="flex flex-1 flex-col justify-end gap-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <Micro>Worked today</Micro>
              <p className="mt-1 text-4xl font-semibold tracking-tighter tabular-nums md:text-5xl">
                <LiveDuration
                  clockInMs={att!.clockIn!.getTime()}
                  breakMinutes={att!.breakMinutes}
                  fallbackMinutes={worked}
                  running={live === "WORKING"}
                />
              </p>
              <p className="mt-2 text-sm opacity-70">
                {live === "BREAK" && open
                  ? `On break since ${fmtTime(open.startedAt)} · clocked in at ${fmtTime(att!.clockIn)}`
                  : `Clocked in at ${fmtTime(att!.clockIn)}`}
                {att!.mode === "REMOTE" && " · remote"}
                {live === "WORKING" &&
                  att!.breakMinutes > 0 &&
                  ` · ${fmtDuration(att!.breakMinutes)} on breaks`}
              </p>
            </div>
            <div className="w-full sm:w-52">
              <div className="flex items-baseline justify-between text-[11px] uppercase tracking-[0.12em] opacity-60">
                <span>Day target</span>
                <span className="tabular-nums normal-case tracking-normal">
                  {policy.fullDayHours}h
                </span>
              </div>
              <ProgressBar
                className="mt-2 bg-panel-ink/10"
                value={worked}
                max={policy.fullDayHours * 60}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-panel-line pt-5 md:flex-row md:items-center">
            {live === "WORKING" ? (
              <form action={startBreak} className="shrink-0">
                <Button type="submit" variant="outline" className={panelBtn}>
                  <Coffee className="size-4" /> Start Break
                </Button>
              </form>
            ) : (
              <form action={endBreak} className="shrink-0">
                <Button type="submit" variant="accent">
                  <Coffee className="size-4" /> End Break
                </Button>
              </form>
            )}
            <form
              action={clockOut}
              className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Input
                name="summary"
                maxLength={2000}
                placeholder="One-line work summary (optional)"
                className={panelInput}
                aria-label="Work summary"
              />
              <Button
                type="submit"
                variant={live === "WORKING" ? "accent" : "outline"}
                className={live === "WORKING" ? "shrink-0" : `shrink-0 ${panelBtn}`}
              >
                <LogOut className="size-4" /> Clock Out
              </Button>
            </form>
          </div>
        </div>
      ) : (
        // NOT_IN (or ABSENT-marked) — ready to clock in
        <div className="flex flex-1 flex-col justify-end gap-6">
          <div>
            <Micro>Worked today</Micro>
            <p className="mt-1 text-4xl font-semibold tracking-tighter tabular-nums opacity-40 md:text-5xl">
              0h 0m
            </p>
            {kind !== "WORKING" ? (
              <p className="mt-2 text-sm opacity-70">
                {kind === "HOLIDAY"
                  ? `It’s ${holidayName ?? "a company holiday"} — clocking in is optional today.`
                  : "It’s the weekend — clocking in is optional today."}
              </p>
            ) : nowIst > graceEnd ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-warn">
                <TriangleAlert className="size-3.5 shrink-0" />
                Grace window ended at {minutesToLabel(graceEnd)} — clocking in
                now is recorded as Late.
              </p>
            ) : (
              <p className="mt-2 text-sm opacity-70">
                You’re on time until {minutesToLabel(graceEnd)}.
              </p>
            )}
          </div>
          <form
            action={clockIn}
            className="flex flex-col gap-4 border-t border-panel-line pt-5 sm:flex-row sm:items-center sm:gap-6"
          >
            <Button type="submit" variant="accent" size="lg" className="px-10">
              <LogIn className="size-4" /> Clock In
            </Button>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm opacity-80">
              <input
                type="checkbox"
                name="remote"
                className="size-4 accent-accent"
              />
              Working remotely
            </label>
          </form>
        </div>
      )}
    </PanelCard>
  );
}
