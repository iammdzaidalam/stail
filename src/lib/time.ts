// All company time is Asia/Kolkata (IST). Timestamps are stored as UTC
// Date objects; calendar days are stored as "YYYY-MM-DD" strings keyed to IST.

export const IST = "Asia/Kolkata";

const dateKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: IST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const hmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "YYYY-MM-DD" for the IST calendar day containing `d`. */
export function dateKey(d: Date = new Date()): string {
  return dateKeyFmt.format(d);
}

export function todayIST(): string {
  return dateKey(new Date());
}

/** "09:42 AM" in IST. */
export function fmtTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return timeFmt.format(d);
}

/** Minutes since IST midnight for a timestamp. */
export function istMinutesOfDay(d: Date): number {
  const [h, m] = hmFmt.format(d).split(":").map(Number);
  return h * 60 + m;
}

/** "10:00" -> 600 */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 600 -> "10:00 AM" */
export function minutesToLabel(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** 522 -> "8h 42m" */
export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

/** Noon-UTC Date for a "YYYY-MM-DD" key (safe for weekday/format math). */
export function keyToDate(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

/** 0=Sunday .. 6=Saturday for a date key. */
export function dayOfWeek(key: string): number {
  return keyToDate(key).getUTCDay();
}

/** "Wednesday, 26 August" */
export function fmtDateLong(key: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(keyToDate(key));
}

/** "26 Aug" */
export function fmtDateShort(key: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(keyToDate(key));
}

/** "26 Aug 2026" */
export function fmtDateFull(key: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(keyToDate(key));
}

/** "Wed" */
export function fmtWeekday(key: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
  }).format(keyToDate(key));
}

export function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of date keys from start to end. */
export function listDates(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Date keys for the last `n` days ending at `end` (inclusive). */
export function lastNDays(n: number, end: string = todayIST()): string[] {
  return listDates(addDays(end, -(n - 1)), end);
}

/** First and last date keys of the month containing `key`. */
export function monthBounds(key: string): { start: string; end: string } {
  const d = keyToDate(key);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Monday-start week bounds for the week containing `key`. */
export function weekBounds(key: string): { start: string; end: string } {
  const dow = dayOfWeek(key); // 0=Sun
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const start = addDays(key, offsetToMonday);
  return { start, end: addDays(start, 6) };
}

/** Relative label like "2h ago" / "just now". */
export function timeAgo(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
