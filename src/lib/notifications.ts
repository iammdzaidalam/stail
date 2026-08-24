import {
  dayKind,
  getHolidayMap,
  getPolicy,
  liveStatus,
} from "./attendance";
import { db } from "./db";
import { isManagerial } from "./rbac";
import { visibleTeamIds } from "./rbac";
import type { CurrentUser } from "./session";
import {
  addDays,
  fmtDateShort,
  fmtWeekday,
  hmToMinutes,
  istMinutesOfDay,
  listDates,
  timeAgo,
  todayIST,
} from "./time";

export type NotificationIcon =
  | "clock"
  | "plan"
  | "report"
  | "inbox"
  | "leave"
  | "correction"
  | "holiday"
  | "announcement";

export type AppNotification = {
  id: string;
  /** "action" items need something from the user; "update" items inform. */
  kind: "action" | "update";
  tone: "accent" | "warn" | "good" | "bad" | "neutral";
  icon: NotificationIcon;
  title: string;
  body?: string;
  href: string;
  /** Short trailing label, e.g. "2h ago" or "Fri". */
  meta?: string;
};

const RECENT_DAYS = 7;

/**
 * Everything the bell shows for a user right now, computed fresh from state
 * (PRD §28): personal nudges, decided requests, approvals waiting on
 * managers, fresh announcements, and upcoming holidays.
 */
export async function getNotificationsFor(
  user: CurrentUser,
): Promise<AppNotification[]> {
  const today = todayIST();
  const recentSince = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
  const managerial = isManagerial(user.role);

  const [policy, holidays, attToday, plan, report, decidedLeaves, decidedCorrections, announcements] =
    await Promise.all([
      getPolicy(),
      getHolidayMap(),
      db.attendance.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
        include: { breaks: true },
      }),
      db.dailyPlan.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
        select: { id: true },
      }),
      db.dailyReport.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
        select: { id: true },
      }),
      db.leave.findMany({
        where: {
          userId: user.id,
          status: { in: ["APPROVED", "REJECTED"] },
          decidedAt: { gte: recentSince },
        },
        include: { approver: { select: { name: true } } },
        orderBy: { decidedAt: "desc" },
        take: 3,
      }),
      db.correctionRequest.findMany({
        where: {
          userId: user.id,
          status: { in: ["APPROVED", "REJECTED"] },
          reviewedAt: { gte: recentSince },
        },
        orderBy: { reviewedAt: "desc" },
        take: 3,
      }),
      db.announcement.findMany({
        where: { createdAt: { gte: recentSince } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, title: true, createdAt: true },
      }),
    ]);

  const actions: AppNotification[] = [];
  const updates: AppNotification[] = [];

  const kind = dayKind(today, policy, holidays);
  const nowIst = istMinutesOfDay(new Date());
  const live = liveStatus(attToday);
  const onLeaveToday = attToday?.status === "LEAVE";

  // ---- personal nudges ----------------------------------------------------
  if (kind === "WORKING" && !onLeaveToday) {
    if (live === "NOT_IN" && nowIst >= hmToMinutes(policy.workStart)) {
      actions.push({
        id: "clock-in",
        kind: "action",
        tone: "warn",
        icon: "clock",
        title: "You haven't clocked in yet",
        body: `Your workday started at ${policy.workStart} IST.`,
        href: "/dashboard",
      });
    }
    if ((live === "WORKING" || live === "BREAK") && !plan && nowIst < 15 * 60) {
      actions.push({
        id: "plan",
        kind: "action",
        tone: "accent",
        icon: "plan",
        title: "Set today's plan",
        body: "Two minutes now keeps the day intentional.",
        href: "/dashboard",
      });
    }
    if (
      !report &&
      attToday?.clockIn &&
      (live === "CLOCKED_OUT" || nowIst >= 17 * 60)
    ) {
      actions.push({
        id: "report",
        kind: "action",
        tone: live === "CLOCKED_OUT" ? "warn" : "accent",
        icon: "report",
        title: "Write today's daily report",
        body:
          live === "CLOCKED_OUT"
            ? "You clocked out without a report — it feeds your weekly summary."
            : "Complete it before you clock out.",
        href: "/reports",
      });
    }
  }

  // ---- approvals waiting on managers -------------------------------------
  if (managerial) {
    const teamIds = await visibleTeamIds(user);
    const scopeUser =
      teamIds === "ALL"
        ? { NOT: { id: user.id } }
        : { teamId: { in: teamIds }, NOT: { id: user.id } };
    const [pendingLeaves, pendingCorrections] = await Promise.all([
      db.leave.count({ where: { status: "PENDING", user: scopeUser } }),
      db.correctionRequest.count({ where: { status: "PENDING", user: scopeUser } }),
    ]);
    const pending = pendingLeaves + pendingCorrections;
    if (pending > 0) {
      actions.push({
        id: "approvals",
        kind: "action",
        tone: "accent",
        icon: "inbox",
        title: `${pending} ${pending === 1 ? "request" : "requests"} waiting for review`,
        body: [
          pendingLeaves > 0 ? `${pendingLeaves} leave` : null,
          pendingCorrections > 0 ? `${pendingCorrections} correction${pendingCorrections === 1 ? "" : "s"}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: "/approvals",
      });
    }

    // Afternoon check: people who worked today but haven't filed a report.
    if (kind === "WORKING" && nowIst >= 15 * 60) {
      const where =
        teamIds === "ALL"
          ? { NOT: { id: user.id }, status: "ACTIVE" }
          : { teamId: { in: teamIds }, NOT: { id: user.id }, status: "ACTIVE" };
      const members = await db.user.findMany({ where, select: { id: true } });
      const ids = members.map((m) => m.id);
      if (ids.length > 0) {
        const [clockedIn, reported] = await Promise.all([
          db.attendance.findMany({
            where: { date: today, userId: { in: ids }, clockIn: { not: null } },
            select: { userId: true },
          }),
          db.dailyReport.findMany({
            where: { date: today, userId: { in: ids } },
            select: { userId: true },
          }),
        ]);
        const reportedSet = new Set(reported.map((r) => r.userId));
        const missing = clockedIn.filter((a) => !reportedSet.has(a.userId)).length;
        if (missing > 0) {
          actions.push({
            id: "team-reports",
            kind: "action",
            tone: "neutral",
            icon: "report",
            title: `${missing} ${missing === 1 ? "person hasn't" : "people haven't"} submitted today's report`,
            href: "/team/reports",
          });
        }
      }
    }
  }

  // ---- updates ------------------------------------------------------------
  for (const l of decidedLeaves) {
    const approved = l.status === "APPROVED";
    updates.push({
      id: `leave-${l.id}`,
      kind: "update",
      tone: approved ? "good" : "bad",
      icon: "leave",
      title: `Leave ${approved ? "approved" : "declined"} — ${fmtDateShort(l.startDate)}${
        l.endDate !== l.startDate ? ` to ${fmtDateShort(l.endDate)}` : ""
      }`,
      body: l.decisionNote ?? (l.approver ? `Reviewed by ${l.approver.name}.` : undefined),
      href: "/leave",
      meta: l.decidedAt ? timeAgo(l.decidedAt) : undefined,
    });
  }
  for (const c of decidedCorrections) {
    const approved = c.status === "APPROVED";
    updates.push({
      id: `correction-${c.id}`,
      kind: "update",
      tone: approved ? "good" : "bad",
      icon: "correction",
      title: `Attendance correction for ${fmtDateShort(c.date)} ${approved ? "approved" : "declined"}`,
      body: c.reviewNote ?? undefined,
      href: "/leave?tab=corrections",
      meta: c.reviewedAt ? timeAgo(c.reviewedAt) : undefined,
    });
  }
  for (const a of announcements) {
    updates.push({
      id: `announcement-${a.id}`,
      kind: "update",
      tone: "neutral",
      icon: "announcement",
      title: a.title,
      body: "New announcement — tap to read.",
      href: "/announcements",
      meta: timeAgo(a.createdAt),
    });
  }

  // Next holiday inside a week.
  const weekAhead = new Set(listDates(addDays(today, 1), addDays(today, 7)));
  const nextHoliday = [...holidays.entries()]
    .filter(([date]) => weekAhead.has(date))
    .sort(([a], [b]) => a.localeCompare(b))[0];
  if (nextHoliday) {
    const [date, name] = nextHoliday;
    updates.push({
      id: `holiday-${date}`,
      kind: "update",
      tone: "neutral",
      icon: "holiday",
      title: `${name} on ${fmtWeekday(date)}`,
      body: `${fmtDateShort(date)} is a holiday — no attendance expected.`,
      href: "/leave?tab=holidays",
    });
  }

  return [...actions, ...updates].slice(0, 10);
}
