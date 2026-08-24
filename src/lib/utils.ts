import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function plural(n: number, singular: string, pluralWord?: string): string {
  return `${n} ${n === 1 ? singular : (pluralWord ?? singular + "s")}`;
}

/** Split newline-separated text (daily plan priorities etc.) into clean lines. */
export function toLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}
