import { db } from "./db";
import type { AttendanceStatus, LiveStatus } from "./definitions";
import { dayOfWeek, hmToMinutes, istMinutesOfDay, minutesBetween } from "./time";

export type PolicyRow = Awaited<ReturnType<typeof getPolicy>>;

/** The single org-wide attendance policy (created on first access). */
export async function getPolicy() {
  const existing = await db.policy.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return db.policy.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export function weekendDaySet(policy: { weekendDays: string }): Set<number> {
  return new Set(
    policy.weekendDays
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
  );
}

/** Map of date key -> holiday name, for quick lookups. */
export async function getHolidayMap(): Promise<Map<string, string>> {
  const rows = await db.holiday.findMany();
  return new Map(rows.map((h) => [h.date, h.name]));
}

export type DayKind = "WORKING" | "WEEKEND" | "HOLIDAY";

export function dayKind(
  date: string,
  policy: { weekendDays: string },
  holidays: Map<string, string>,
): DayKind {
  if (holidays.has(date)) return "HOLIDAY";
  if (weekendDaySet(policy).has(dayOfWeek(date))) return "WEEKEND";
  return "WORKING";
}

/** PRESENT within grace period of workStart, LATE after. */
export function clockInStatus(
  clockIn: Date,
  policy: { workStart: string; graceMinutes: number },
): "PRESENT" | "LATE" {
  const cutoff = hmToMinutes(policy.workStart) + policy.graceMinutes;
  return istMinutesOfDay(clockIn) <= cutoff ? "PRESENT" : "LATE";
}

/** Downgrade to HALF_DAY when the worked time is under the threshold. */
export function finalDayStatus(
  base: "PRESENT" | "LATE",
  totalMinutes: number,
  policy: { halfDayThresholdHours: number },
): AttendanceStatus {
  if (totalMinutes < policy.halfDayThresholdHours * 60) return "HALF_DAY";
  return base;
}

type BreakRow = { startedAt: Date; endedAt: Date | null };
type AttendanceLike = {
  clockIn: Date | null;
  clockOut: Date | null;
  breakMinutes: number;
  status: string;
  breaks?: BreakRow[];
};

export function openBreak<T extends BreakRow>(breaks: T[] | undefined): T | null {
  return breaks?.find((b) => b.endedAt === null) ?? null;
}

/** Net minutes worked so far (or final if clocked out), excluding breaks. */
export function workedMinutes(att: AttendanceLike, now: Date = new Date()): number {
  if (!att.clockIn) return 0;
  const end = att.clockOut ?? now;
  let breakMins = att.breakMinutes;
  const open = openBreak(att.breaks);
  if (open && !att.clockOut) breakMins += minutesBetween(open.startedAt, now);
  return Math.max(0, minutesBetween(att.clockIn, end) - breakMins);
}

/** Right-now presence state derived from today's attendance row. */
export function liveStatus(att: AttendanceLike | null | undefined): LiveStatus {
  if (!att) return "NOT_IN";
  // Clock fields win: someone clocked in on a weekend/holiday is still working.
  if (att.clockIn) {
    if (att.clockOut) return "CLOCKED_OUT";
    if (openBreak(att.breaks)) return "BREAK";
    return "WORKING";
  }
  if (att.status === "LEAVE") return "LEAVE";
  if (att.status === "ABSENT") return "ABSENT";
  return "NOT_IN";
}

/** Attendance rate helpers used across dashboards. */
export function attendanceRate(present: number, workingDays: number): number {
  if (workingDays <= 0) return 0;
  return Math.round((present / workingDays) * 1000) / 10;
}
