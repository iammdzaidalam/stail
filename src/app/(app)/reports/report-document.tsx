import { StatusBadge } from "@/components/ui/badge";
import { Card, CardLabel } from "@/components/ui/card";
import { fmtDateLong, fmtDuration, fmtTime } from "@/lib/time";
import { toLines } from "@/lib/utils";

export type ReportAttendanceLine = {
  clockIn: Date | null;
  clockOut: Date | null;
  status: string;
  /** Net worked minutes for the day — precomputed by the caller. */
  minutes: number | null;
};

export type ReportRow = {
  date: string;
  accomplishments: string;
  pending: string | null;
  blockers: string | null;
  tomorrowPlan: string | null;
  notes: string | null;
  submittedAt: Date;
};

function Section({ label, lines }: { label: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div>
      <CardLabel>{label}</CardLabel>
      <ul className="mt-2.5 space-y-2">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink">
            <span
              className="mt-[8px] size-1 shrink-0 rounded-full bg-ink-faint"
              aria-hidden
            />
            <span className="min-w-0">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** PRD-style daily report rendered as a formatted document card. */
export function ReportDocument({
  name,
  report,
  attendance,
  className,
}: {
  name: string;
  report: ReportRow;
  attendance?: ReportAttendanceLine | null;
  className?: string;
}) {
  const completed = toLines(report.accomplishments);
  const pending = toLines(report.pending);
  const blockers = toLines(report.blockers);
  const tomorrow = toLines(report.tomorrowPlan);
  const notes = report.notes?.trim();

  return (
    <Card className={className ?? "p-6 md:p-8"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardLabel>Daily Report</CardLabel>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight">
            {name} — Daily Report
          </h3>
          <p className="mt-1 text-xs text-ink-faint">
            {fmtDateLong(report.date)} {report.date.slice(0, 4)} · Submitted{" "}
            {fmtTime(report.submittedAt)}
          </p>
        </div>
        {attendance && <StatusBadge status={attendance.status} />}
      </div>

      {attendance && (
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-surface-2/60 px-4 py-3 text-xs text-ink-soft">
          <span>
            Clock-in{" "}
            <span className="font-medium tabular-nums text-ink">
              {fmtTime(attendance.clockIn)}
            </span>
          </span>
          <span>
            Clock-out{" "}
            <span className="font-medium tabular-nums text-ink">
              {fmtTime(attendance.clockOut)}
            </span>
          </span>
          <span>
            Working time{" "}
            <span className="font-medium tabular-nums text-ink">
              {fmtDuration(attendance.minutes)}
            </span>
          </span>
        </div>
      )}

      <div className="mt-6 space-y-6 border-t border-line pt-6">
        <Section label="Completed" lines={completed} />
        <Section label="Pending" lines={pending} />
        <Section label="Blockers" lines={blockers} />
        <Section label="Tomorrow" lines={tomorrow} />
        {notes && (
          <p className="text-xs leading-relaxed text-ink-faint">
            <span className="font-medium uppercase tracking-[0.14em]">Notes</span>{" "}
            — {notes}
          </p>
        )}
      </div>
    </Card>
  );
}
