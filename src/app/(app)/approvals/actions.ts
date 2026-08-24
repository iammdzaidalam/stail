"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/session";
import { visibleTeamIds } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  clockInStatus,
  dayKind,
  finalDayStatus,
  getHolidayMap,
  getPolicy,
} from "@/lib/attendance";
import { listDates, minutesBetween } from "@/lib/time";
import { istDateTime } from "./helpers";

const APPROVER_ROLES = ["TEAM_LEAD", "MANAGER", "HR", "FOUNDER"] as const;

/**
 * May `viewer` decide a request from `requester`? Self-approval is always
 * forbidden; otherwise the requester must be inside the viewer's team scope.
 */
async function canDecideFor(
  viewer: CurrentUser,
  requester: { id: string; teamId: string | null },
): Promise<boolean> {
  if (requester.id === viewer.id) return false;
  const ids = await visibleTeamIds(viewer);
  if (ids === "ALL") return true;
  return requester.teamId != null && ids.includes(requester.teamId);
}

function readDecision(formData: FormData): {
  id: string;
  decision: "APPROVED" | "REJECTED" | null;
  note: string;
} {
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 2000);
  const decision = raw === "APPROVED" || raw === "REJECTED" ? raw : null;
  return { id, decision, note };
}

export async function decideLeave(formData: FormData): Promise<void> {
  const user = await requireUser([...APPROVER_ROLES]);
  const { id, decision, note } = readDecision(formData);
  if (!id || !decision) return;

  const leave = await db.leave.findUnique({
    where: { id },
    include: { user: { select: { id: true, teamId: true } } },
  });
  if (!leave || leave.status !== "PENDING") redirect("/approvals?problem=decided");
  if (!(await canDecideFor(user, leave.user))) return;

  await db.leave.update({
    where: { id },
    data: {
      status: decision,
      approverId: user.id,
      decidedAt: new Date(),
      decisionNote: note || null,
    },
  });

  if (decision === "APPROVED") {
    const [policy, holidayMap] = await Promise.all([getPolicy(), getHolidayMap()]);
    const workingDays = listDates(leave.startDate, leave.endDate).filter(
      (d) => dayKind(d, policy, holidayMap) === "WORKING",
    );
    for (const date of workingDays) {
      const existing = await db.attendance.findUnique({
        where: { userId_date: { userId: leave.userId, date } },
      });
      // Never overwrite a day the person actually worked.
      if (existing?.clockIn) continue;
      await db.attendance.upsert({
        where: { userId_date: { userId: leave.userId, date } },
        update: {
          status: "LEAVE",
          clockIn: null,
          clockOut: null,
          totalMinutes: null,
          breakMinutes: 0,
        },
        create: { userId: leave.userId, date, status: "LEAVE" },
      });
    }
  }

  await logAudit({
    actor: { id: user.id, name: user.name },
    action: decision === "APPROVED" ? "leave.approve" : "leave.reject",
    entity: "Leave",
    entityId: leave.id,
    before: { status: "PENDING" },
    after: { status: decision, decisionNote: note || null },
  });

  revalidatePath("/", "layout");
  redirect(
    decision === "APPROVED"
      ? "/approvals?done=leave-approved"
      : "/approvals?done=leave-rejected",
  );
}

export async function decideCorrection(formData: FormData): Promise<void> {
  const user = await requireUser([...APPROVER_ROLES]);
  const { id, decision, note } = readDecision(formData);
  if (!id || !decision) return;

  const correction = await db.correctionRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, teamId: true } } },
  });
  if (!correction || correction.status !== "PENDING") {
    redirect("/approvals?tab=corrections&problem=decided");
  }
  if (!(await canDecideFor(user, correction.user))) return;

  if (decision === "REJECTED") {
    await db.correctionRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewerId: user.id,
        reviewedAt: new Date(),
        reviewNote: note || null,
      },
    });
    await logAudit({
      actor: { id: user.id, name: user.name },
      action: "correction.reject",
      entity: "CorrectionRequest",
      entityId: correction.id,
      before: { status: "PENDING" },
      after: { status: "REJECTED", reviewNote: note || null },
    });
    revalidatePath("/", "layout");
    redirect("/approvals?tab=corrections&done=correction-rejected");
  }

  const policy = await getPolicy();
  const existing = await db.attendance.findUnique({
    where: { userId_date: { userId: correction.userId, date: correction.date } },
  });

  // An approved-leave day can't be silently converted into presence; the
  // leave has to be cancelled first. Leave the request pending.
  if (existing?.status === "LEAVE") {
    redirect("/approvals?tab=corrections&problem=leave-day");
  }

  const newClockIn = correction.requestedClockIn
    ? istDateTime(correction.date, correction.requestedClockIn)
    : (existing?.clockIn ?? null);
  const newClockOut = correction.requestedClockOut
    ? istDateTime(correction.date, correction.requestedClockOut)
    : (existing?.clockOut ?? null);
  const breakMinutes = existing?.breakMinutes ?? 0;

  // A clock-out with no clock-in (neither requested nor on record) or an
  // inverted interval can't produce a valid day.
  if (!newClockIn) {
    redirect("/approvals?tab=corrections&problem=missing-clock-in");
  }
  if (newClockOut && newClockOut <= newClockIn) {
    redirect("/approvals?tab=corrections&problem=inverted-times");
  }

  const kind = dayKind(correction.date, policy, await getHolidayMap());
  let totalMinutes: number | null = null;
  let status: string;
  if (newClockOut) {
    totalMinutes = Math.max(0, minutesBetween(newClockIn, newClockOut) - breakMinutes);
    status =
      kind === "WORKING"
        ? finalDayStatus(clockInStatus(newClockIn, policy), totalMinutes, policy)
        : kind;
  } else {
    status = kind === "WORKING" ? clockInStatus(newClockIn, policy) : kind;
  }

  const beforeAtt = existing
    ? {
        clockIn: existing.clockIn,
        clockOut: existing.clockOut,
        status: existing.status,
        totalMinutes: existing.totalMinutes,
      }
    : null;
  const afterAtt = { clockIn: newClockIn, clockOut: newClockOut, status, totalMinutes };

  await db.attendance.upsert({
    where: { userId_date: { userId: correction.userId, date: correction.date } },
    update: { clockIn: newClockIn, clockOut: newClockOut, status, totalMinutes },
    create: {
      userId: correction.userId,
      date: correction.date,
      clockIn: newClockIn,
      clockOut: newClockOut,
      status,
      totalMinutes,
    },
  });

  await db.correctionRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewerId: user.id,
      reviewedAt: new Date(),
      reviewNote: note || null,
    },
  });

  await logAudit({
    actor: { id: user.id, name: user.name },
    action: "correction.approve",
    entity: "CorrectionRequest",
    entityId: correction.id,
    before: { status: "PENDING", attendance: beforeAtt },
    after: { status: "APPROVED", reviewNote: note || null, attendance: afterAtt },
  });

  revalidatePath("/", "layout");
  redirect("/approvals?tab=corrections&done=correction-approved");
}
