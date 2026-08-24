// Shared helpers for the CSV export route handlers.

import { IST } from "@/lib/time";

/** Quote a CSV field when needed; double embedded quotes. */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a CSV document from a header row + data rows. */
export function toCsv(
  header: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [header, ...rows].map((row) => row.map(csvField).join(","));
  return lines.join("\r\n") + "\r\n";
}

const istHMFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "14:05" in IST for a timestamp; "" for null. */
export function istHM(d: Date | null | undefined): string {
  if (!d) return "";
  return istHMFmt.format(d);
}

const istDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-08-24 14:05" in IST for a timestamp; "" for null. */
export function istDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  return `${istDateFmt.format(d)} ${istHMFmt.format(d)}`;
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}
