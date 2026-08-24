// Local helpers for the leave area (shared by page + actions).

import { dayKind } from "@/lib/attendance";
import { addDays, listDates } from "@/lib/time";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Working days (per policy weekends + holiday calendar) in an inclusive span. */
export function countWorkingDays(
  start: string,
  end: string,
  policy: { weekendDays: string },
  holidays: Map<string, string>,
): number {
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) return 0;
  // Defensive cap so a malformed span can never build a huge list.
  const cappedEnd = end > addDays(start, 365) ? addDays(start, 365) : end;
  return listDates(start, cappedEnd).filter(
    (d) => dayKind(d, policy, holidays) === "WORKING",
  ).length;
}

/** Later of two date keys (ISO strings compare lexicographically). */
export function maxKey(a: string, b: string): string {
  return a > b ? a : b;
}

/** Earlier of two date keys. */
export function minKey(a: string, b: string): string {
  return a < b ? a : b;
}
