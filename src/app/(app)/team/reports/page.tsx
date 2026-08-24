import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, NotebookPen, Users } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { dayKind, getHolidayMap, getPolicy, workedMinutes } from "@/lib/attendance";
import { addDays, fmtDateLong, fmtDuration, fmtTime, todayIST } from "@/lib/time";
import { cn, plural, toLines } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/lib/definitions";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import {
  firstParam,
  getMembers,
  getVisibleTeams,
  resolveSelection,
  teamTabs,
  type Member,
} from "../shared";

function ReportSection({
  label,
  lines,
  tone,
}: {
  label: string;
  lines: string[];
  tone?: "warn";
}) {
  if (lines.length === 0) return null;
  return (
    <div>
      <CardLabel className={tone === "warn" ? "text-warn" : undefined}>{label}</CardLabel>
      <ul className="mt-2 space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
            <span
              className={cn(
                "mt-[7px] size-1 shrink-0 rounded-full",
                tone === "warn" ? "bg-warn" : "bg-ink-faint",
              )}
            />
            <span className="min-w-0">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function TeamReportsPage({
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
          title="Team Reports"
          description="Daily reports from your teams, one place to review them."
        />
        <EmptyState
          icon={<Users className="size-6" />}
          title="No teams visible yet"
          hint="You are not linked to any team as its lead. Ask HR to assign you to a team to review daily reports."
        />
      </>
    );
  }

  // Date filter: default today, never future.
  const rawDate = firstParam(sp.date);
  let date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  if (date > today) date = today;

  const { selected, teamIds } = resolveSelection(teams, sp.team);
  const tabs = teamTabs(
    "/team/reports",
    teams,
    selected,
    date !== today ? { date } : {},
  );
  const dayHref = (d: string) => {
    const params = new URLSearchParams();
    if (d !== today) params.set("date", d);
    if (selected) params.set("team", selected.id);
    const qs = params.toString();
    return qs ? `/team/reports?${qs}` : "/team/reports";
  };

  const members = await getMembers(teamIds);
  const memberIds = members.map((m) => m.id);
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const [policy, holidayMap, attendance, reports] = await Promise.all([
    getPolicy(),
    getHolidayMap(),
    db.attendance.findMany({
      where: { date, userId: { in: memberIds } },
      include: { breaks: true },
    }),
    db.dailyReport.findMany({
      where: { date, userId: { in: memberIds } },
    }),
  ]);
  const kind = dayKind(date, policy, holidayMap);
  const now = new Date();
  const attMap = new Map(attendance.map((a) => [a.userId, a]));
  const reportedIds = new Set(reports.map((r) => r.userId));

  // Worked that day (clockIn set) but no report -> missing.
  const missing = members.filter(
    (m) => attMap.get(m.id)?.clockIn && !reportedIds.has(m.id),
  );
  // Everyone else without a report was away that day (leave/absent/weekend...).
  const awayReason = (m: Member): string => {
    const att = attMap.get(m.id);
    if (att?.status === "LEAVE") return "Leave";
    if (att?.status === "HOLIDAY" || (!att && kind === "HOLIDAY")) return "Holiday";
    if (att?.status === "WEEKEND" || (!att && kind === "WEEKEND")) return "Weekend";
    if (!att && date === today) return "Not started";
    return "Absent";
  };
  const away = members
    .filter((m) => !attMap.get(m.id)?.clockIn && !reportedIds.has(m.id))
    .map((m) => ({ member: m, reason: awayReason(m) }));

  // Blocker digest: every blocker line across the day's reports, deduped.
  const blockerMap = new Map<string, { line: string; names: string[] }>();
  for (const report of reports) {
    const who = memberMap.get(report.userId)?.name ?? "Unknown";
    for (const line of toLines(report.blockers)) {
      const key = line.toLowerCase();
      const existing = blockerMap.get(key);
      if (existing) {
        if (!existing.names.includes(who)) existing.names.push(who);
      } else {
        blockerMap.set(key, { line, names: [who] });
      }
    }
  }
  const blockers = [...blockerMap.values()];

  const cards = reports
    .map((report) => ({ report, member: memberMap.get(report.userId) }))
    .filter((c): c is { report: (typeof reports)[number]; member: Member } => !!c.member)
    .sort((a, b) => a.member.name.localeCompare(b.member.name));

  const isToday = date === today;

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="Team Reports"
        description={`${fmtDateLong(date)}${isToday ? " · today" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={dayHref(addDays(date, -1))}
              aria-label="Previous day"
              className={buttonClass({ variant: "outline", size: "icon", className: "size-8" })}
            >
              <ChevronLeft className="size-4" />
            </Link>
            <form action="/team/reports" method="get" className="flex items-center gap-2">
              {selected && <input type="hidden" name="team" value={selected.id} />}
              <input
                key={date}
                type="date"
                name="date"
                defaultValue={date}
                max={today}
                className="h-8 rounded-xl border border-line bg-surface px-2.5 text-xs text-ink outline-accent outline-offset-2 focus-visible:outline-2"
              />
              <Button variant="outline" size="sm" type="submit">
                Go
              </Button>
            </form>
            {isToday ? (
              <span
                aria-hidden
                className={buttonClass({
                  variant: "outline",
                  size: "icon",
                  className: "size-8 pointer-events-none opacity-40",
                })}
              >
                <ChevronRight className="size-4" />
              </span>
            ) : (
              <Link
                href={dayHref(addDays(date, 1))}
                aria-label="Next day"
                className={buttonClass({ variant: "outline", size: "icon", className: "size-8" })}
              >
                <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        }
      />

      <div className="mb-6">
        <LinkTabs tabs={tabs} />
      </div>

      {/* Day summary */}
      <PanelCard className="flex flex-wrap items-center gap-x-12 gap-y-5 px-6 py-5">
        {[
          { label: "Reports in", value: reports.length },
          { label: "Missing", value: missing.length },
          { label: "Away", value: away.length },
          { label: "Blockers", value: blockers.length },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tighter tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
        <p className="ml-auto hidden max-w-[220px] text-xs opacity-50 md:block">
          {kind === "WORKING"
            ? `${plural(members.length, "member")} in scope on this working day.`
            : `Non-working day (${kind === "HOLIDAY" ? "holiday" : "weekend"}) — reports optional.`}
        </p>
      </PanelCard>

      {/* Blocker digest */}
      {blockers.length > 0 && (
        <Card className="mt-4 border-warn/40 bg-warn/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warn" />
            <CardLabel className="text-warn">
              Blockers surfaced {isToday ? "today" : "this day"} ({blockers.length})
            </CardLabel>
          </div>
          <ul className="mt-4 space-y-2.5">
            {blockers.map((b) => (
              <li key={b.line} className="flex items-start gap-2.5 text-sm">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-warn" />
                <span className="min-w-0">
                  {b.line}
                  <span className="ml-2 text-xs text-ink-faint">— {b.names.join(", ")}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Missing / away strip */}
      <Card className="mt-4 flex flex-col gap-5">
        <div>
          <CardLabel>Missing reports</CardLabel>
          {missing.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {missing.map((m) => (
                <Link key={m.id} href={`/people/${m.id}`} className="max-w-full hover:opacity-80">
                  <Badge tone="warn" className="max-w-44">
                    <span className="truncate">{m.name}</span>
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              {kind === "WORKING"
                ? "Everyone who clocked in has reported."
                : "No reports expected on a non-working day."}
            </p>
          )}
        </div>
        {away.length > 0 && (
          <div>
            <CardLabel>Not working this day</CardLabel>
            <div className="mt-2.5 flex flex-wrap gap-1.5 opacity-60">
              {away.map(({ member, reason }) => (
                <Badge key={member.id} tone="outline">
                  {member.name} · {reason}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Report documents */}
      <SectionTitle title={plural(cards.length, "report")} className="mt-10" />
      {cards.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="size-6" />}
          title="No reports submitted this day"
          hint={
            kind === "WORKING"
              ? "Reports will appear here as members submit their end-of-day summary."
              : `This was a ${kind === "HOLIDAY" ? "holiday" : "weekend"} — no reports were expected.`
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {cards.map(({ report, member }) => {
            const att = attMap.get(member.id);
            // Only today can have a live "so far" duration; a past day with a
            // missing clock-out has no meaningful total.
            const duration = att?.clockIn
              ? att.totalMinutes != null
                ? fmtDuration(att.totalMinutes)
                : date === today
                  ? fmtDuration(workedMinutes(att, now))
                  : null
              : null;
            return (
              <Card key={report.id} className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <Link
                    href={`/people/${member.id}`}
                    className="flex min-w-0 items-center gap-3 hover:opacity-80"
                  >
                    <Avatar name={member.name} hue={member.avatarHue} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {member.name}
                      </span>
                      <span className="block max-w-[200px] truncate text-xs text-ink-faint">
                        {member.title ?? ROLE_LABELS[member.role as Role]}
                      </span>
                    </span>
                  </Link>
                  <div className="flex flex-col items-end gap-1.5">
                    {att && <StatusBadge status={att.status} />}
                    <span className="text-[11px] tabular-nums text-ink-faint">
                      {att?.clockIn
                        ? `${fmtTime(att.clockIn)} → ${att.clockOut ? fmtTime(att.clockOut) : "…"}${duration ? ` · ${duration}` : ""}`
                        : "No attendance record"}
                    </span>
                  </div>
                </div>

                <ReportSection label="Completed" lines={toLines(report.accomplishments)} />
                <ReportSection label="Pending" lines={toLines(report.pending)} />
                <ReportSection label="Blockers" lines={toLines(report.blockers)} tone="warn" />
                <ReportSection label="Tomorrow" lines={toLines(report.tomorrowPlan)} />
                {report.notes && (
                  <div>
                    <CardLabel>Notes</CardLabel>
                    <p className="mt-2 text-sm text-ink-soft">{report.notes}</p>
                  </div>
                )}

                <p className="mt-auto border-t border-line pt-3 text-[11px] text-ink-faint">
                  Submitted {fmtTime(report.submittedAt)}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
