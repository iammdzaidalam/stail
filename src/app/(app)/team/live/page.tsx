import Link from "next/link";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { liveStatus, openBreak, workedMinutes } from "@/lib/attendance";
import { fmtDuration, fmtTime, minutesBetween, todayIST, fmtDateLong } from "@/lib/time";
import { ROLE_LABELS, type LiveStatus, type Role } from "@/lib/definitions";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { getMembers, getVisibleTeams } from "../shared";
import { AutoRefresh } from "./auto-refresh";

// WORKING first, then BREAK, NOT_IN, CLOCKED_OUT, LEAVE.
const SORT_ORDER: Record<LiveStatus, number> = {
  WORKING: 0,
  BREAK: 1,
  NOT_IN: 2,
  ABSENT: 3,
  CLOCKED_OUT: 4,
  LEAVE: 5,
};

export default async function TeamLivePage() {
  const user = await requireUser(["TEAM_LEAD", "MANAGER", "HR", "FOUNDER"]);
  const teams = await getVisibleTeams(user);
  const today = todayIST();

  if (teams.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Team"
          title="Live Status"
          description="Who is working right now across your teams."
        />
        <EmptyState
          icon={<Users className="size-6" />}
          title="No teams visible yet"
          hint="You are not linked to any team as its lead. Ask HR to assign you to a team to unlock the live board."
        />
      </>
    );
  }

  const members = await getMembers(teams.map((t) => t.id));
  const attendance = await db.attendance.findMany({
    where: { date: today, userId: { in: members.map((m) => m.id) } },
    include: { breaks: true },
  });
  const now = new Date();
  const attMap = new Map(attendance.map((a) => [a.userId, a]));

  const rows = members.map((member) => {
    const att = attMap.get(member.id) ?? null;
    const status = liveStatus(att);
    const brk = att && !att.clockOut ? openBreak(att.breaks) : null;
    return {
      member,
      att,
      status,
      worked: att?.clockIn ? workedMinutes(att, now) : 0,
      breakMinutes: brk ? minutesBetween(brk.startedAt, now) : null,
    };
  });

  const count = (...statuses: LiveStatus[]) =>
    rows.filter((r) => statuses.includes(r.status)).length;
  const working = count("WORKING");
  const onBreak = count("BREAK");
  const notStarted = count("NOT_IN", "ABSENT");
  const clockedOut = count("CLOCKED_OUT");
  const onLeave = count("LEAVE");

  const groups = teams
    .map((team) => ({
      team,
      rows: rows
        .filter((r) => r.member.teamId === team.id)
        .sort(
          (a, b) =>
            SORT_ORDER[a.status] - SORT_ORDER[b.status] ||
            a.member.name.localeCompare(b.member.name),
        ),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="Live Status"
        description={`${fmtDateLong(today)} · refreshes every 30 seconds`}
        actions={<AutoRefresh />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Working now"
          value={working}
          tone="panel"
          sub={`of ${members.length} members`}
        />
        <StatCard label="On break" value={onBreak} sub="paused, still on the clock" />
        <StatCard label="Not started" value={notStarted} sub="no clock-in yet" />
        <StatCard label="Clocked out" value={clockedOut} sub="done for the day" />
        <StatCard label="On leave" value={onLeave} sub="approved leave today" />
      </div>

      <SectionTitle title="Board" className="mt-10" />
      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No members in your teams yet"
          hint="Once people are assigned to your teams, their live status will appear here."
        />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Status</Th>
                <Th>Clock-in</Th>
                <Th>Hours so far</Th>
                <Th>Mode</Th>
                <Th>Break</Th>
              </tr>
            </thead>
            {groups.map(({ team, rows: teamRows }) => {
              const inNow = teamRows.filter(
                (r) => r.status === "WORKING" || r.status === "BREAK",
              ).length;
              return (
                <tbody key={team.id}>
                  <tr className="border-t border-line bg-surface-2/50">
                    <td colSpan={6} className="px-5 py-2.5">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft">
                          {team.name}
                          <span className="ml-2 normal-case tracking-normal text-ink-faint">
                            {team.department}
                          </span>
                        </span>
                        <span className="text-[11px] tabular-nums text-ink-faint">
                          {inNow} of {teamRows.length} in
                        </span>
                      </span>
                    </td>
                  </tr>
                  {teamRows.map(({ member, att, status, worked, breakMinutes }) => (
                    <Tr key={member.id}>
                      <Td>
                        <Link
                          href={`/people/${member.id}`}
                          className="flex items-center gap-3 hover:opacity-80"
                        >
                          <Avatar name={member.name} hue={member.avatarHue} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {member.name}
                            </span>
                            <span className="block max-w-[180px] truncate text-xs text-ink-faint">
                              {member.title ?? ROLE_LABELS[member.role as Role]}
                            </span>
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <StatusBadge status={status} />
                      </Td>
                      <Td className="text-sm tabular-nums text-ink-soft">
                        {fmtTime(att?.clockIn)}
                      </Td>
                      <Td className="text-sm tabular-nums text-ink-soft">
                        {att?.clockIn ? fmtDuration(worked) : "—"}
                      </Td>
                      <Td>
                        {att?.mode === "REMOTE" ? (
                          <StatusBadge status="REMOTE" />
                        ) : att?.clockIn ? (
                          <span className="text-xs text-ink-faint">Office</span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                      <Td>
                        {breakMinutes != null ? (
                          <Badge tone="warn" dot>
                            {fmtDuration(breakMinutes)}
                          </Badge>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              );
            })}
          </Table>
        </TableWrap>
      )}
    </>
  );
}
