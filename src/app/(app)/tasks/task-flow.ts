import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/definitions";

/**
 * Status moves the server accepts. Canonical chain
 * BACKLOG → TODO → IN_PROGRESS → BLOCKED / IN_REVIEW → COMPLETED,
 * one step back from anywhere, plus a "complete" shortcut from any
 * open status. COMPLETED sets completedAt; leaving it clears it.
 */
export const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  BACKLOG: ["TODO", "COMPLETED"],
  TODO: ["BACKLOG", "IN_PROGRESS", "COMPLETED"],
  IN_PROGRESS: ["TODO", "BLOCKED", "IN_REVIEW", "COMPLETED"],
  BLOCKED: ["IN_PROGRESS", "COMPLETED"],
  IN_REVIEW: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: ["IN_REVIEW"],
};

/** Transitions shown as pill buttons on the detail page (canonical chain + one step back). */
export const DISPLAY_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  BACKLOG: ["TODO"],
  TODO: ["BACKLOG", "IN_PROGRESS"],
  IN_PROGRESS: ["TODO", "BLOCKED", "IN_REVIEW"],
  BLOCKED: ["IN_PROGRESS", "COMPLETED"],
  IN_REVIEW: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: ["IN_REVIEW"],
};

/** The single "next sensible step" used by the list's quick-advance button. */
export const QUICK_ADVANCE: Partial<Record<TaskStatus, { to: TaskStatus; label: string }>> = {
  BACKLOG: { to: "TODO", label: "To Do" },
  TODO: { to: "IN_PROGRESS", label: "Start" },
  IN_PROGRESS: { to: "IN_REVIEW", label: "In Review" },
  BLOCKED: { to: "IN_PROGRESS", label: "Resume" },
  IN_REVIEW: { to: "COMPLETED", label: "Complete" },
};

const TRANSITION_LABELS: Record<string, string> = {
  "BACKLOG:TODO": "Move to To Do",
  "TODO:BACKLOG": "Back to Backlog",
  "TODO:IN_PROGRESS": "Start work",
  "IN_PROGRESS:TODO": "Back to To Do",
  "IN_PROGRESS:BLOCKED": "Mark blocked",
  "IN_PROGRESS:IN_REVIEW": "Send to review",
  "BLOCKED:IN_PROGRESS": "Resume work",
  "BLOCKED:COMPLETED": "Complete",
  "IN_REVIEW:IN_PROGRESS": "Back to In Progress",
  "IN_REVIEW:COMPLETED": "Complete",
  "COMPLETED:IN_REVIEW": "Reopen",
};

export function transitionLabel(from: TaskStatus, to: TaskStatus): string {
  return TRANSITION_LABELS[`${from}:${to}`] ?? `Move to ${TASK_STATUS_LABELS[to]}`;
}
