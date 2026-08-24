// Enum-like constants for string-typed fields (SQLite has no native enums).

export const ROLES = [
  "INTERN",
  "EMPLOYEE",
  "TEAM_LEAD",
  "MANAGER",
  "HR",
  "FOUNDER",
  "SUPER_ADMIN",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  INTERN: "Intern",
  EMPLOYEE: "Employee",
  TEAM_LEAD: "Team Lead",
  MANAGER: "Manager",
  HR: "HR",
  FOUNDER: "Founder",
  SUPER_ADMIN: "Super Admin",
};

/** Roles that can see beyond their own data (team level and up). */
export const MANAGERIAL_ROLES: Role[] = [
  "TEAM_LEAD",
  "MANAGER",
  "HR",
  "FOUNDER",
  "SUPER_ADMIN",
];
/** Roles with org-wide visibility. */
export const ORG_ROLES: Role[] = ["MANAGER", "HR", "FOUNDER", "SUPER_ADMIN"];
/**
 * Roles with administrative powers (people, registrations, teams, policies,
 * holidays, audit). HR and Founder deliberately have the same powers as the
 * Super Admin — the Super Admin account is simply the protected root account.
 */
export const ADMIN_ROLES: Role[] = ["HR", "FOUNDER", "SUPER_ADMIN"];

/** Account lifecycle. Only ACTIVE users can log in. */
export const USER_STATUSES = ["ACTIVE", "PENDING", "REJECTED", "EXITED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const EMPLOYMENT_TYPES = ["FULL_TIME", "INTERN", "CONTRACT"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  INTERN: "Intern",
  CONTRACT: "Contract",
};

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "HALF_DAY",
  "ABSENT",
  "LEAVE",
  "HOLIDAY",
  "WEEKEND",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  LATE: "Late",
  HALF_DAY: "Half Day",
  ABSENT: "Absent",
  LEAVE: "Leave",
  HOLIDAY: "Holiday",
  WEEKEND: "Weekend",
};

export const ATTENDANCE_MODES = ["OFFICE", "REMOTE"] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

/** Live (right now) state derived from today's attendance row. */
export type LiveStatus = "WORKING" | "BREAK" | "CLOCKED_OUT" | "NOT_IN" | "LEAVE" | "ABSENT";
export const LIVE_STATUS_LABELS: Record<LiveStatus, string> = {
  WORKING: "Working",
  BREAK: "On Break",
  CLOCKED_OUT: "Clocked Out",
  NOT_IN: "Not Started",
  LEAVE: "On Leave",
  ABSENT: "Absent",
};

export const TASK_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "COMPLETED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In Review",
  COMPLETED: "Completed",
};

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "UNPAID", "OTHER"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  EARNED: "Earned",
  UNPAID: "Unpaid",
  OTHER: "Other",
};

export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const HOLIDAY_TYPES = ["NATIONAL", "COMPANY", "OPTIONAL"] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export const PROJECT_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
