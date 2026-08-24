import { ArrowRight, Check, X } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { visibleTeamIds } from "@/lib/rbac";
import { getHolidayMap, getPolicy } from "@/lib/attendance";
import { LEAVE_TYPE_LABELS, type LeaveType } from "@/lib/definitions";
import {
  fmtDateFull,
  fmtDateShort,
  fmtTime,
  fmtWeekday,
  hmToMinutes,
  minutesToLabel,
  timeAgo,
} from "@/lib/time";
import { plural } from "@/lib/utils";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { NoticeBanner } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty";
import { Spark } from "@/components/ui/spark";
import { decideCorrection, decideLeave } from "./actions";
import { countWorkingDays } from "./helpers";

const NOTICES: Record<string, { tone: "good" | "warn" | "bad"; text: string }> = {
  "done:leave-approved": { tone: "good", text: "Leave approved — the calendar days are marked and the person has been notified." },
  "done:leave-rejected": { tone: "good", text: "Leave declined — the requester can see your note." },
  "done:correction-approved": { tone: "good", text: "Correction approved — the attendance record was updated and audit-logged." },
  "done:correction-rejected": { tone: "good", text: "Correction declined — the requester can see your note." },
  "problem:decided": { tone: "warn", text: "That request was already decided (possibly by another approver), so nothing changed." },
  "problem:leave-day": { tone: "bad", text: "That day is approved leave. Ask the person to cancel the leave first, or decline this correction." },
  "problem:missing-clock-in": { tone: "bad", text: "This correction only sets a clock-out, but the day has no clock-in on record. Decline it and ask for both times." },
  "problem:inverted-times": { tone: "bad", text: "The requested clock-out is earlier than the clock-in. Decline it and ask them to resubmit." },
};

function actionNotice(
  sp: Record<string, string | string[] | undefined>,
): { tone: "good" | "warn" | "bad"; text: string } | null {
  if (typeof sp.done === "string") return NOTICES[`done:${sp.done}`] ?? null;
  if (typeof sp.problem === "string") return NOTICES[`problem:${sp.problem}`] ?? null;
  return null;
}

function leaveTypeLabel(type: string): string {
  return LEAVE_TYPE_LABELS[type as LeaveType] ?? type;
}

const requesterInclude = {
  user: {
    select: {
      id: true,
      name: true,
      avatarHue: true,
      team: { select: { name: true } },
    },
  },
} as const;

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(["TEAM_LEAD", "MANAGER", "HR", "FOUNDER", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const tab = sp.tab === "corrections" ? "corrections" : "leave";
  const notice = actionNotice(sp);

  const teamIds = await visibleTeamIds(user);
  const requesterScope = teamIds === "ALL" ? {} : { teamId: { in: teamIds } };
  // Never show the viewer's own requests — self-approval is forbidden.
  const scopedWhere = { userId: { not: user.id }, user: requesterScope };

  const [policy, holidayMap] = await Promise.all([getPolicy(), getHolidayMap()]);

  const [pendingLeaves, decidedLeaves, pendingCorrections, decidedCorrections] =
    await Promise.all([
      db.leave.findMany({
        where: { ...scopedWhere, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: requesterInclude,
      }),
      db.leave.findMany({
        where: { ...scopedWhere, status: { in: ["APPROVED", "REJECTED"] } },
        orderBy: { decidedAt: "desc" },
        take: 10,
        include: { ...requesterInclude, approver: { select: { name: true } } },
      }),
      db.correctionRequest.findMany({
        where: { ...scopedWhere, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: requesterInclude,
      }),
      db.correctionRequest.findMany({
        where: { ...scopedWhere, status: { in: ["APPROVED", "REJECTED"] } },
        orderBy: { reviewedAt: "desc" },
        take: 10,
        include: { ...requesterInclude, reviewer: { select: { name: true } } },
      }),
    ]);

  // Current attendance rows for the days being corrected.
  const attPairs = pendingCorrections.map((c) => ({ userId: c.userId, date: c.date }));
  const attRows = attPairs.length
    ? await db.attendance.findMany({ where: { OR: attPairs } })
    : [];
  const attByKey = new Map(attRows.map((a) => [`${a.userId}|${a.date}`, a]));

  const totalPending = pendingLeaves.length + pendingCorrections.length;

  const tabs = [
    {
      href: "/approvals",
      label: "Leave",
      active: tab === "leave",
      count: pendingLeaves.length,
    },
    {
      href: "/approvals?tab=corrections",
      label: "Corrections",
      active: tab === "corrections",
      count: pendingCorrections.length,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title="Approvals"
        description="Review leave and attendance-correction requests from the people you cover."
      />

      {notice && (
        <NoticeBanner
          tone={notice.tone}
          dismissHref={tab === "corrections" ? "/approvals?tab=corrections" : "/approvals"}
        >
          {notice.text}
        </NoticeBanner>
      )}

      <PanelCard className="mb-6 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
            Pending review
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
            {totalPending}
          </p>
          <p className="mt-1.5 text-sm opacity-60">
            {plural(pendingLeaves.length, "leave request")} ·{" "}
            {plural(pendingCorrections.length, "correction")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs opacity-60">
          <Spark className="size-4" />
          {teamIds === "ALL" ? "Org-wide scope" : `${plural(teamIds.length, "team")} in scope`}
        </div>
      </PanelCard>

      <LinkTabs tabs={tabs} className="mb-6" />

      {tab === "leave" ? (
        <div className="flex flex-col gap-6">
          {pendingLeaves.length === 0 ? (
            <EmptyState
              icon={<Spark className="size-6" />}
              title="Inbox zero"
              hint="No pending leave requests from your teams right now."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {pendingLeaves.map((l) => {
                const days = countWorkingDays(l.startDate, l.endDate, policy, holidayMap);
                return (
                  <Card key={l.id} className="p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-3.5">
                        <Avatar name={l.user.name} hue={l.user.avatarHue} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{l.user.name}</p>
                            <Badge tone="neutral">{leaveTypeLabel(l.type)}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-ink-faint">
                            {l.user.team?.name ?? "No team"} · applied {timeAgo(l.createdAt)}
                          </p>
                          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-soft">
                            {l.reason}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 rounded-2xl bg-surface-2/60 px-4 py-3 lg:text-right">
                        <CardLabel>Dates</CardLabel>
                        <p className="mt-1 whitespace-nowrap text-sm font-semibold tabular-nums">
                          {fmtDateShort(l.startDate)}
                          {l.endDate !== l.startDate && ` – ${fmtDateShort(l.endDate)}`}
                        </p>
                        <p className="text-xs text-ink-faint">{plural(days, "working day")}</p>
                      </div>
                    </div>
                    <form
                      action={decideLeave}
                      className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4 sm:flex-row sm:items-center"
                    >
                      <input type="hidden" name="id" value={l.id} />
                      <Input
                        name="note"
                        placeholder="Decision note (optional)"
                        maxLength={2000}
                        className="h-9 flex-1 rounded-full px-4 text-xs"
                      />
                      <div className="flex gap-2">
                        <SubmitButton name="decision" value="APPROVED" variant="accent" size="sm" pendingLabel="Saving…">
                          <Check className="size-3.5" /> Approve
                        </SubmitButton>
                        <SubmitButton name="decision" value="REJECTED" variant="outline" size="sm" pendingLabel="Saving…">
                          <X className="size-3.5" /> Reject
                        </SubmitButton>
                      </div>
                    </form>
                  </Card>
                );
              })}
            </div>
          )}

          {decidedLeaves.length > 0 && (
            <div className="min-w-0">
              <SectionTitle title="Recently decided" />
              <Card className="p-2">
                <ul className="divide-y divide-line">
                  {decidedLeaves.map((l) => (
                    <li
                      key={l.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3"
                    >
                      <Avatar name={l.user.name} hue={l.user.avatarHue} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {l.user.name}
                          <span className="text-ink-faint">
                            {" "}
                            · {leaveTypeLabel(l.type)} · {fmtDateShort(l.startDate)}
                            {l.endDate !== l.startDate && ` – ${fmtDateShort(l.endDate)}`}
                          </span>
                        </p>
                      </div>
                      <StatusBadge status={l.status} />
                      <p className="whitespace-nowrap text-xs text-ink-faint">
                        by {l.approver?.name ?? "—"}
                        {l.decidedAt && ` · ${timeAgo(l.decidedAt)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {pendingCorrections.length === 0 ? (
            <EmptyState
              icon={<Spark className="size-6" />}
              title="Inbox zero"
              hint="No pending attendance corrections from your teams right now."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {pendingCorrections.map((c) => {
                const att = attByKey.get(`${c.userId}|${c.date}`);
                const currentLabel = att
                  ? `${fmtTime(att.clockIn)} – ${fmtTime(att.clockOut)}`
                  : "— / —";
                const requestedLabel = `${
                  c.requestedClockIn
                    ? minutesToLabel(hmToMinutes(c.requestedClockIn))
                    : "—"
                } – ${
                  c.requestedClockOut
                    ? minutesToLabel(hmToMinutes(c.requestedClockOut))
                    : "—"
                }`;
                return (
                  <Card key={c.id} className="p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-3.5">
                        <Avatar name={c.user.name} hue={c.user.avatarHue} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{c.user.name}</p>
                            <Badge tone="outline">
                              {fmtWeekday(c.date)}, {fmtDateFull(c.date)}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-ink-faint">
                            {c.user.team?.name ?? "No team"} · requested {timeAgo(c.createdAt)}
                          </p>
                          <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-soft">
                            {c.reason}
                          </p>
                        </div>
                      </div>
                      <div className="flex max-w-full flex-wrap items-center gap-4 rounded-2xl bg-surface-2/60 px-4 py-3">
                        <div>
                          <CardLabel>Currently</CardLabel>
                          <p className="mt-1 whitespace-nowrap text-sm font-medium tabular-nums">
                            {currentLabel}
                          </p>
                          <StatusBadge status={att?.status ?? "ABSENT"} className="mt-1.5" />
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-ink-faint" />
                        <div>
                          <CardLabel>Requested</CardLabel>
                          <p className="mt-1 whitespace-nowrap text-sm font-semibold tabular-nums">
                            {requestedLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                    <form
                      action={decideCorrection}
                      className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4 sm:flex-row sm:items-center"
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <Input
                        name="note"
                        placeholder="Review note (optional)"
                        maxLength={2000}
                        className="h-9 flex-1 rounded-full px-4 text-xs"
                      />
                      <div className="flex gap-2">
                        <SubmitButton name="decision" value="APPROVED" variant="accent" size="sm" pendingLabel="Saving…">
                          <Check className="size-3.5" /> Approve
                        </SubmitButton>
                        <SubmitButton name="decision" value="REJECTED" variant="outline" size="sm" pendingLabel="Saving…">
                          <X className="size-3.5" /> Reject
                        </SubmitButton>
                      </div>
                    </form>
                  </Card>
                );
              })}
            </div>
          )}

          {decidedCorrections.length > 0 && (
            <div className="min-w-0">
              <SectionTitle title="Recently decided" />
              <Card className="p-2">
                <ul className="divide-y divide-line">
                  {decidedCorrections.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3"
                    >
                      <Avatar name={c.user.name} hue={c.user.avatarHue} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {c.user.name}
                          <span className="text-ink-faint">
                            {" "}
                            · {fmtDateShort(c.date)} ·{" "}
                            {c.requestedClockIn
                              ? minutesToLabel(hmToMinutes(c.requestedClockIn))
                              : "—"}
                            {" – "}
                            {c.requestedClockOut
                              ? minutesToLabel(hmToMinutes(c.requestedClockOut))
                              : "—"}
                          </span>
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                      <p className="whitespace-nowrap text-xs text-ink-faint">
                        by {c.reviewer?.name ?? "—"}
                        {c.reviewedAt && ` · ${timeAgo(c.reviewedAt)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
