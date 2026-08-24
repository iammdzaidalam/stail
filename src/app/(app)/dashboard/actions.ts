"use server";

import { revalidatePath } from "next/cache";
import {
  clockInStatus,
  dayKind,
  finalDayStatus,
  getHolidayMap,
  getPolicy,
  openBreak,
  workedMinutes,
} from "@/lib/attendance";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { minutesBetween, todayIST } from "@/lib/time";

/** Today's attendance row for a user, with breaks (null when not created yet). */
async function todayRow(userId: string, date: string) {
  return db.attendance.findUnique({
    where: { userId_date: { userId, date } },
    include: { breaks: true },
  });
}

/**
 * Clock in for today. Idempotent: no-ops when already clocked in or when the
 * day is recorded as leave. All timestamps are server-generated.
 */
export async function clockIn(formData: FormData): Promise<void> {
  const user = await requireUser();
  const date = todayIST();
  const existing = await todayRow(user.id, date);
  if (existing && (existing.clockIn || existing.status === "LEAVE")) {
    // Already clocked in (e.g. from another tab) — refresh to show it.
    revalidatePath("/", "layout");
    return;
  }

  const mode = formData.get("remote") === "on" ? "REMOTE" : "OFFICE";
  const now = new Date();
  const policy = await getPolicy();
  // Voluntary weekend/holiday work keeps the day's WEEKEND/HOLIDAY status so
  // attendance-rate and late stats (which count PRESENT/LATE against working
  // days) are never inflated by off-day clock-ins.
  const kind = dayKind(date, policy, await getHolidayMap());
  const status = kind === "WORKING" ? clockInStatus(now, policy) : kind;

  await db.attendance.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { clockIn: now, status, mode },
    create: { userId: user.id, date, clockIn: now, status, mode },
  });
  revalidatePath("/", "layout");
}

/**
 * Clock out for today: closes any open break, computes the day's total and
 * final status (PRESENT/LATE downgraded to HALF_DAY under the threshold).
 */
export async function clockOut(formData: FormData): Promise<void> {
  const user = await requireUser();
  const att = await todayRow(user.id, todayIST());
  if (!att || !att.clockIn || att.clockOut) {
    revalidatePath("/", "layout");
    return;
  }

  const now = new Date();
  const raw = formData.get("summary");
  const summary = typeof raw === "string" ? raw.trim().slice(0, 2000) : "";

  let breakMinutes = att.breakMinutes;
  const open = openBreak(att.breaks);
  if (open) {
    breakMinutes += minutesBetween(open.startedAt, now);
    await db.break.update({ where: { id: open.id }, data: { endedAt: now } });
  }

  const policy = await getPolicy();
  const totalMinutes = workedMinutes({
    clockIn: att.clockIn,
    clockOut: now,
    breakMinutes,
    status: att.status,
  });
  const status =
    att.status === "WEEKEND" || att.status === "HOLIDAY"
      ? att.status // off-day work is never late or half-day
      : finalDayStatus(clockInStatus(att.clockIn, policy), totalMinutes, policy);

  await db.attendance.update({
    where: { id: att.id },
    data: {
      clockOut: now,
      breakMinutes,
      totalMinutes,
      status,
      workSummary: summary || att.workSummary,
    },
  });
  revalidatePath("/", "layout");
}

/** Start a break. Only valid while working (clocked in, no open break). */
export async function startBreak(): Promise<void> {
  const user = await requireUser();
  const att = await todayRow(user.id, todayIST());
  if (!att || !att.clockIn || att.clockOut || openBreak(att.breaks)) {
    revalidatePath("/", "layout");
    return;
  }

  await db.break.create({
    data: { attendanceId: att.id, startedAt: new Date() },
  });
  revalidatePath("/", "layout");
}

/** End the open break and accumulate its minutes onto the day. */
export async function endBreak(): Promise<void> {
  const user = await requireUser();
  const att = await todayRow(user.id, todayIST());
  if (!att || att.clockOut) {
    revalidatePath("/", "layout");
    return;
  }
  const open = openBreak(att.breaks);
  if (!open) {
    revalidatePath("/", "layout");
    return;
  }

  const now = new Date();
  await db.break.update({ where: { id: open.id }, data: { endedAt: now } });
  await db.attendance.update({
    where: { id: att.id },
    data: { breakMinutes: att.breakMinutes + minutesBetween(open.startedAt, now) },
  });
  revalidatePath("/", "layout");
}

/** Create or update today's daily plan (priorities are newline-separated). */
export async function submitPlan(formData: FormData): Promise<void> {
  const user = await requireUser();
  const date = todayIST();

  const rawPriorities = formData.get("priorities");
  const priorities =
    typeof rawPriorities === "string" ? rawPriorities.trim().slice(0, 2000) : "";
  if (!priorities) return;

  const rawDeliverables = formData.get("deliverables");
  const deliverables =
    typeof rawDeliverables === "string"
      ? rawDeliverables.trim().slice(0, 2000)
      : "";

  await db.dailyPlan.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: {
      priorities,
      deliverables: deliverables || null,
      submittedAt: new Date(),
    },
    create: {
      userId: user.id,
      date,
      priorities,
      deliverables: deliverables || null,
    },
  });
  revalidatePath("/", "layout");
}
