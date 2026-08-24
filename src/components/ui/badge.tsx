import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "accent" | "good" | "warn" | "bad" | "outline";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-soft",
  accent: "bg-accent text-accent-ink",
  good: "bg-good/15 text-good",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/12 text-bad",
  outline: "border border-line-strong text-ink-soft",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Show a leading status dot; "pulse" animates it. */
  dot?: boolean | "pulse";
}

export function Badge({ tone = "neutral", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            dot === "pulse" && "animate-pulse",
          )}
        />
      )}
      {children}
    </span>
  );
}

// One shared map so attendance, task, priority, request, and live statuses
// render consistently everywhere.
const STATUS_TONES: Record<string, { tone: BadgeTone; label: string; dot?: boolean | "pulse" }> = {
  // attendance day statuses
  PRESENT: { tone: "good", label: "Present" },
  LATE: { tone: "warn", label: "Late" },
  HALF_DAY: { tone: "warn", label: "Half Day" },
  ABSENT: { tone: "bad", label: "Absent" },
  LEAVE: { tone: "neutral", label: "Leave" },
  HOLIDAY: { tone: "neutral", label: "Holiday" },
  WEEKEND: { tone: "neutral", label: "Weekend" },
  // live statuses
  WORKING: { tone: "accent", label: "Working", dot: "pulse" },
  BREAK: { tone: "warn", label: "On Break", dot: true },
  CLOCKED_OUT: { tone: "neutral", label: "Clocked Out" },
  NOT_IN: { tone: "outline", label: "Not Started" },
  // task statuses
  BACKLOG: { tone: "outline", label: "Backlog" },
  TODO: { tone: "neutral", label: "To Do" },
  IN_PROGRESS: { tone: "accent", label: "In Progress" },
  BLOCKED: { tone: "bad", label: "Blocked" },
  IN_REVIEW: { tone: "warn", label: "In Review" },
  COMPLETED: { tone: "good", label: "Completed" },
  // priorities
  LOW: { tone: "outline", label: "Low" },
  MEDIUM: { tone: "neutral", label: "Medium" },
  HIGH: { tone: "warn", label: "High" },
  CRITICAL: { tone: "bad", label: "Critical" },
  // request lifecycle
  PENDING: { tone: "warn", label: "Pending" },
  APPROVED: { tone: "good", label: "Approved" },
  REJECTED: { tone: "bad", label: "Rejected" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
  // holiday types
  NATIONAL: { tone: "accent", label: "National" },
  COMPANY: { tone: "neutral", label: "Company" },
  OPTIONAL: { tone: "outline", label: "Optional" },
  // misc
  ACTIVE: { tone: "good", label: "Active" },
  PAUSED: { tone: "warn", label: "Paused" },
  ARCHIVED: { tone: "neutral", label: "Archived" },
  OFFICE: { tone: "neutral", label: "Office" },
  REMOTE: { tone: "outline", label: "Remote" },
  EXITED: { tone: "bad", label: "Exited" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const cfg = STATUS_TONES[status] ?? { tone: "neutral" as BadgeTone, label: status };
  return (
    <Badge tone={cfg.tone} dot={cfg.dot} className={className}>
      {cfg.label}
    </Badge>
  );
}
