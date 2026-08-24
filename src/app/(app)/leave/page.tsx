import { CalendarRange } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getHolidayMap, getPolicy, type PolicyRow } from "@/lib/attendance";
import { LEAVE_TYPE_LABELS, type LeaveType } from "@/lib/definitions";
import {
  addDays,
  fmtDateFull,
  fmtDateShort,
  fmtWeekday,
  listDates,
  minutesToLabel,
  hmToMinutes,
  todayIST,
} from "@/lib/time";
import { plural } from "@/lib/utils";
import { NoticeBanner } from "@/components/ui/notice";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { Card, CardLabel, PanelCard } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { cancelLeave } from "./actions";
import { countWorkingDays, DATE_RE, maxKey, minKey } from "./helpers";
import { LeaveForm } from "./leave-form";
import { CorrectionForm } from "./correction-form";

const TABS = ["leaves", "corrections", "holidays"] as const;
type Tab = (typeof TABS)[number];

function leaveTypeLabel(type: string): string {
  return LEAVE_TYPE_LABELS[type as LeaveType] ?? type;
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : "leaves";
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "leaves";
  const prefillDate =
    typeof sp.date === "string" && DATE_RE.test(sp.date) ? sp.date : undefined;

  const [policy, holidayMap] = await Promise.all([getPolicy(), getHolidayMap()]);
  const today = todayIST();

  const tabs = [
    { href: "/leave", label: "Leaves", active: tab === "leaves" },
    { href: "/leave?tab=corrections", label: "Corrections", active: tab === "corrections" },
    { href: "/leave?tab=holidays", label: "Holidays", active: tab === "holidays" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Leave & Requests"
        description="Apply for time off, fix attendance mistakes, and check the holiday calendar."
      />
      {sp.problem === "already-decided" && (
        <NoticeBanner tone="warn" dismissHref="/leave">
          That request was already decided while you were looking at it, so it
          can&apos;t be cancelled — check its status below.
        </NoticeBanner>
      )}
      <LinkTabs tabs={tabs} className="mb-6" />

      {tab === "leaves" && (
        <LeavesTab userId={user.id} today={today} policy={policy} holidayMap={holidayMap} />
      )}
      {tab === "corrections" && (
        <CorrectionsTab userId={user.id} today={today} prefillDate={prefillDate} />
      )}
      {tab === "holidays" && <HolidaysTab today={today} />}
    </div>
  );
}

/* ------------------------------- Leaves tab ------------------------------- */

async function LeavesTab({
  userId,
  today,
  policy,
  holidayMap,
}: {
  userId: string;
  today: string;
  policy: PolicyRow;
  holidayMap: Map<string, string>;
}) {
  const leaves = await db.leave.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { approver: { select: { name: true } } },
  });

  const year = today.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const approved = leaves.filter((l) => l.status === "APPROVED");

  const takenThisYear = approved.reduce(
    (n, l) =>
      n + countWorkingDays(maxKey(l.startDate, yearStart), minKey(l.endDate, today), policy, holidayMap),
    0,
  );
  const sickUsed = approved
    .filter((l) => l.type === "SICK")
    .reduce(
      (n, l) =>
        n + countWorkingDays(maxKey(l.startDate, yearStart), minKey(l.endDate, today), policy, holidayMap),
      0,
    );
  const pendingCount = leaves.filter((l) => l.status === "PENDING").length;
  const upcoming = approved.filter((l) => l.endDate >= today);
  const upcomingDays = upcoming.reduce(
    (n, l) => n + countWorkingDays(maxKey(l.startDate, today), l.endDate, policy, holidayMap),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="panel"
          label="Taken this year"
          value={takenThisYear}
          sub={`working days in ${year}`}
        />
        <StatCard label="Pending requests" value={pendingCount} sub="awaiting a decision" />
        <StatCard label="Sick days used" value={sickUsed} sub="approved sick leave" />
        <StatCard
          label="Upcoming approved"
          value={upcomingDays}
          sub={plural(upcoming.length, "request") + " ahead"}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card>
          <CardLabel className="mb-4">Apply for leave</CardLabel>
          <LeaveForm today={today} minStart={addDays(today, -3)} />
        </Card>

        <div className="min-w-0">
          <SectionTitle title="My leave history" />
          {leaves.length === 0 ? (
            <EmptyState
              title="No leave requests yet"
              hint="When you apply for time off, your requests and their decisions show up here."
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th>Dates</Th>
                    <Th className="text-right">Days</Th>
                    <Th>Reason</Th>
                    <Th>Status</Th>
                    <Th>Decision</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => {
                    const days = countWorkingDays(l.startDate, l.endDate, policy, holidayMap);
                    return (
                      <Tr key={l.id}>
                        <Td>
                          <Badge tone="neutral">{leaveTypeLabel(l.type)}</Badge>
                        </Td>
                        <Td className="whitespace-nowrap tabular-nums">
                          {fmtDateShort(l.startDate)}
                          {l.endDate !== l.startDate && ` – ${fmtDateShort(l.endDate)}`}
                        </Td>
                        <Td className="text-right tabular-nums">{days}</Td>
                        <Td>
                          <p className="max-w-64 whitespace-normal break-words text-xs leading-relaxed text-ink-soft">
                            {l.reason}
                          </p>
                        </Td>
                        <Td>
                          <StatusBadge status={l.status} />
                        </Td>
                        <Td>
                          {l.approver ? (
                            <div>
                              <p className="text-xs font-medium">{l.approver.name}</p>
                              {l.decisionNote && (
                                <p className="max-w-56 whitespace-normal break-words text-xs leading-relaxed text-ink-soft">
                                  {l.decisionNote}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </Td>
                        <Td className="text-right">
                          {l.status === "PENDING" && (
                            <form action={cancelLeave}>
                              <input type="hidden" name="id" value={l.id} />
                              <Button type="submit" variant="ghost" size="sm">
                                Cancel
                              </Button>
                            </form>
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
      </div>
    </div>
  );
}

/* ---------------------------- Corrections tab ----------------------------- */

async function CorrectionsTab({
  userId,
  today,
  prefillDate,
}: {
  userId: string;
  today: string;
  prefillDate?: string;
}) {
  const corrections = await db.correctionRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { reviewer: { select: { name: true } } },
  });
  const pending = corrections.filter((c) => c.status === "PENDING").length;

  const yesterday = addDays(today, -1);
  const minDate = addDays(today, -30);
  const defaultDate =
    prefillDate && prefillDate <= yesterday && prefillDate >= minDate
      ? prefillDate
      : yesterday;

  return (
    <div className="flex flex-col gap-6">
      <PanelCard className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
            Attendance corrections
          </p>
          <p className="mt-2 max-w-md text-lg font-semibold leading-snug tracking-tight">
            Missed a clock-in or clock-out? Request a fix for any day in the last 30.
          </p>
        </div>
        <div className="md:text-right">
          <p className="text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
            {pending}
          </p>
          <p className="text-xs opacity-60">pending review</p>
        </div>
      </PanelCard>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card>
          <CardLabel className="mb-4">Request a correction</CardLabel>
          <CorrectionForm defaultDate={defaultDate} minDate={minDate} maxDate={yesterday} />
        </Card>

        <div className="min-w-0">
          <SectionTitle title="My corrections" />
          {corrections.length === 0 ? (
            <EmptyState
              title="No corrections yet"
              hint="If a day was recorded wrong, request a correction and your lead will review it."
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Requested</Th>
                    <Th>Reason</Th>
                    <Th>Status</Th>
                    <Th>Reviewed by</Th>
                  </tr>
                </thead>
                <tbody>
                  {corrections.map((c) => (
                    <Tr key={c.id}>
                      <Td className="whitespace-nowrap tabular-nums">{fmtDateShort(c.date)}</Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {c.requestedClockIn
                          ? minutesToLabel(hmToMinutes(c.requestedClockIn))
                          : "—"}
                        {" → "}
                        {c.requestedClockOut
                          ? minutesToLabel(hmToMinutes(c.requestedClockOut))
                          : "—"}
                      </Td>
                      <Td>
                        <p className="max-w-64 whitespace-normal break-words text-xs leading-relaxed text-ink-soft">
                          {c.reason}
                        </p>
                      </Td>
                      <Td>
                        <StatusBadge status={c.status} />
                      </Td>
                      <Td>
                        {c.reviewer ? (
                          <div>
                            <p className="text-xs font-medium">{c.reviewer.name}</p>
                            {c.reviewNote && (
                              <p className="max-w-56 whitespace-normal break-words text-xs leading-relaxed text-ink-soft">
                                {c.reviewNote}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Holidays tab ------------------------------ */

async function HolidaysTab({ today }: { today: string }) {
  const holidays = await db.holiday.findMany({ orderBy: { date: "asc" } });
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const upcoming = holidays.filter((h) => h.date >= today);
  const pastThisYear = holidays
    .filter((h) => h.date < today && h.date >= yearStart)
    .reverse();
  const next = upcoming[0];

  if (holidays.length === 0) {
    return (
      <EmptyState
        icon={<CalendarRange className="size-6" />}
        title="No holidays configured"
        hint="HR hasn't published the holiday calendar yet."
      />
    );
  }

  const daysAway = next ? listDates(today, next.date).length - 1 : null;

  return (
    <div className="flex flex-col gap-6">
      {next && (
        <PanelCard className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
              Next holiday
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tighter md:text-4xl">
              {next.name}
            </p>
            <p className="mt-1.5 text-sm opacity-60">
              {fmtDateFull(next.date)} · {fmtWeekday(next.date)}
              {next.type === "OPTIONAL" && " · Optional"}
            </p>
          </div>
          <div className="md:text-right">
            <p className="text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
              {daysAway === 0 ? "Today" : daysAway}
            </p>
            <p className="text-xs opacity-60">
              {daysAway === 0
                ? "enjoy the day off"
                : daysAway === 1
                  ? "day to go"
                  : "days to go"}
            </p>
          </div>
        </PanelCard>
      )}

      <div className="min-w-0">
        <SectionTitle title="Upcoming" />
        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming holidays"
            hint="The rest of the year has no published holidays."
          />
        ) : (
          <Card className="p-2">
            <ul className="divide-y divide-line">
              {upcoming.map((h) => (
                <HolidayRow key={h.id} holiday={h} />
              ))}
            </ul>
          </Card>
        )}
        <p className="mt-3 text-xs text-ink-faint">
          Optional holidays are floating — apply for leave if you plan to take one.
        </p>
      </div>

      {pastThisYear.length > 0 && (
        <div className="min-w-0">
          <SectionTitle title="Earlier this year" />
          <Card className="p-2">
            <ul className="divide-y divide-line">
              {pastThisYear.map((h) => (
                <HolidayRow key={h.id} holiday={h} />
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

function HolidayRow({
  holiday,
}: {
  holiday: { date: string; name: string; type: string };
}) {
  return (
    <li className="flex items-center gap-4 px-4 py-3.5">
      <div className="w-20 shrink-0">
        <p className="text-sm font-semibold tabular-nums">{fmtDateShort(holiday.date)}</p>
        <p className="text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          {fmtWeekday(holiday.date)}
        </p>
      </div>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{holiday.name}</p>
      <StatusBadge status={holiday.type} />
    </li>
  );
}
