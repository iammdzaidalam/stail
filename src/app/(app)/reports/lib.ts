import { addDays } from "@/lib/time";

/** UTC instant at which the IST calendar day `key` begins (IST = UTC+5:30). */
export function istDayStart(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0) - 330 * 60000);
}

/**
 * Prisma DateTime filter covering the IST days startKey..endKey (inclusive).
 * With one argument it covers that single day.
 */
export function istDayRange(
  startKey: string,
  endKey: string = startKey,
): { gte: Date; lt: Date } {
  return { gte: istDayStart(startKey), lt: istDayStart(addDays(endKey, 1)) };
}

/** hsl() color for a project hue (matches the seeded Project.hue values). */
export function projectColor(hue: number | null): string {
  return hue == null ? "hsl(0 0% 62%)" : `hsl(${hue} 65% 55%)`;
}
