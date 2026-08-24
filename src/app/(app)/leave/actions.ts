"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { LEAVE_TYPES, type LeaveType } from "@/lib/definitions";
import { addDays, hmToMinutes, todayIST } from "@/lib/time";
import { DATE_RE, TIME_RE } from "./helpers";

export type LeaveFormState = {
  error?: string;
  ok?: boolean;
  values?: { type?: string; startDate?: string; endDate?: string; reason?: string };
};

export type CorrectionFormState = {
  error?: string;
  ok?: boolean;
  values?: { date?: string; clockIn?: string; clockOut?: string; reason?: string };
};

export async function applyLeave(
  _prev: LeaveFormState,
  formData: FormData,
): Promise<LeaveFormState> {
  const user = await requireUser();

  const type = String(formData.get("type") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const reason = String(formData.get("reason") ?? "")
    .trim()
    .slice(0, 2000);
  const values = { type, startDate, endDate, reason };

  if (!LEAVE_TYPES.includes(type as LeaveType))
    return { error: "Pick a valid leave type.", values };
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate))
    return { error: "Pick both a start and an end date.", values };

  const today = todayIST();
  const earliestStart = addDays(today, -3);
  if (startDate < earliestStart)
    return {
      error: "Start date can be at most 3 days in the past (backfilled sick leave).",
      values,
    };
  if (endDate < startDate)
    return { error: "End date must be on or after the start date.", values };
  if (endDate > addDays(startDate, 29))
    return { error: "A single request can span at most 30 days.", values };
  if (!reason) return { error: "Add a short reason for your approver.", values };

  const overlapping = await db.leave.findFirst({
    where: {
      userId: user.id,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlapping) {
    return {
      error: "You already have a pending or approved leave overlapping these dates.",
      values,
    };
  }

  const leave = await db.leave.create({
    data: {
      userId: user.id,
      type,
      startDate,
      endDate,
      reason,
      status: "PENDING",
    },
  });

  await logAudit({
    actor: { id: user.id, name: user.name },
    action: "leave.apply",
    entity: "Leave",
    entityId: leave.id,
    after: { type, startDate, endDate, status: "PENDING" },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function cancelLeave(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const leave = await db.leave.findUnique({ where: { id } });
  if (!leave || leave.userId !== user.id) return;
  // Only pending requests can be cancelled — tell the user when it's too late.
  if (leave.status !== "PENDING") redirect("/leave?problem=already-decided");

  await db.leave.update({ where: { id }, data: { status: "CANCELLED" } });
  await logAudit({
    actor: { id: user.id, name: user.name },
    action: "leave.cancel",
    entity: "Leave",
    entityId: id,
    before: { status: "PENDING" },
    after: { status: "CANCELLED" },
  });

  revalidatePath("/", "layout");
}

export async function requestCorrection(
  _prev: CorrectionFormState,
  formData: FormData,
): Promise<CorrectionFormState> {
  const user = await requireUser();

  const date = String(formData.get("date") ?? "").trim();
  const clockIn = String(formData.get("clockIn") ?? "").trim();
  const clockOut = String(formData.get("clockOut") ?? "").trim();
  const reason = String(formData.get("reason") ?? "")
    .trim()
    .slice(0, 2000);
  const values = { date, clockIn, clockOut, reason };

  const today = todayIST();
  if (!DATE_RE.test(date)) return { error: "Pick the date to correct.", values };
  if (date >= today)
    return { error: "Corrections are for past days only.", values };
  if (date < addDays(today, -30))
    return { error: "Corrections can only go back 30 days.", values };

  if (!clockIn && !clockOut)
    return { error: "Provide at least one time — clock-in or clock-out.", values };
  if (clockIn && !TIME_RE.test(clockIn))
    return { error: "Clock-in must be a valid HH:mm time.", values };
  if (clockOut && !TIME_RE.test(clockOut))
    return { error: "Clock-out must be a valid HH:mm time.", values };
  if (clockIn && clockOut && hmToMinutes(clockOut) <= hmToMinutes(clockIn))
    return { error: "Clock-out must be after clock-in.", values };
  if (!reason) return { error: "Explain what happened that day.", values };

  const duplicate = await db.correctionRequest.findFirst({
    where: { userId: user.id, date, status: "PENDING" },
    select: { id: true },
  });
  if (duplicate)
    return { error: "A correction for this date is already pending review.", values };

  const correction = await db.correctionRequest.create({
    data: {
      userId: user.id,
      date,
      requestedClockIn: clockIn || null,
      requestedClockOut: clockOut || null,
      reason,
      status: "PENDING",
    },
  });

  await logAudit({
    actor: { id: user.id, name: user.name },
    action: "correction.request",
    entity: "CorrectionRequest",
    entityId: correction.id,
    after: {
      date,
      requestedClockIn: clockIn || null,
      requestedClockOut: clockOut || null,
      status: "PENDING",
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
