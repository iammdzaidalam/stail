// Local helpers for the approvals area.

import { dayKind } from "@/lib/attendance";
import { addDays, listDates } from "@/lib/time";

/** Working days (per policy weekends + holiday calendar) in an inclusive span. */
export function countWorkingDays(
  start: string,
  end: string,
  policy: { weekendDays: string },
  holidays: Map<string, string>,
): number {
  if (start > end) return 0;
  // Defensive cap so a malformed span can never build a huge list.
  const cappedEnd = end > addDays(start, 365) ? addDays(start, 365) : end;
  return listDates(start, cappedEnd).filter(
    (d) => dayKind(d, policy, holidays) === "WORKING",
  ).length;
}

/** UTC Date for an IST wall-clock HH:mm on a YYYY-MM-DD key. */
export function istDateTime(dateKey: string, hm: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const minutes = (hh || 0) * 60 + (mm || 0);
  return new Date(Date.UTC(y, m - 1, d, 0, 0) + minutes * 60000 - 330 * 60000);
}
