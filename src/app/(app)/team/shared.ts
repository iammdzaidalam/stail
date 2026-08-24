// Shared helpers for the /team area (team overview, live board, reports).
// Route-local only — never imported from other feature areas.

import { db } from "@/lib/db";
import { visibleTeamIds } from "@/lib/rbac";
import type { LinkTab } from "@/components/ui/tabs";

export type TeamOption = { id: string; name: string; department: string };

type UserLike = { id: string; role: string; teamId?: string | null };

/** Teams the viewer may see (org roles -> all), sorted by name. */
export async function getVisibleTeams(user: UserLike): Promise<TeamOption[]> {
  const ids = await visibleTeamIds(user);
  if (ids !== "ALL" && ids.length === 0) return [];
  return db.team.findMany({
    where: ids === "ALL" ? {} : { id: { in: ids } },
    select: { id: true, name: true, department: true },
    orderBy: { name: "asc" },
  });
}

/** First value of a (possibly repeated) search param. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Resolve the ?team= selection against the visible teams.
 * `selected === null` means the "All teams" aggregate (only offered when the
 * viewer can see more than one team).
 */
export function resolveSelection(
  teams: TeamOption[],
  raw: string | string[] | undefined,
): { selected: TeamOption | null; teamIds: string[] } {
  const param = firstParam(raw);
  const found = param ? teams.find((t) => t.id === param) : undefined;
  if (found) return { selected: found, teamIds: [found.id] };
  if (teams.length === 1) return { selected: teams[0], teamIds: [teams[0].id] };
  return { selected: null, teamIds: teams.map((t) => t.id) };
}

/** Pill tabs for the team selector, preserving extra query params. */
export function teamTabs(
  basePath: string,
  teams: TeamOption[],
  selected: TeamOption | null,
  extra: Record<string, string> = {},
): LinkTab[] {
  const href = (teamId?: string) => {
    const params = new URLSearchParams(extra);
    if (teamId) params.set("team", teamId);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const tabs: LinkTab[] = [];
  if (teams.length > 1) {
    tabs.push({ href: href(), label: "All teams", active: selected === null });
  }
  for (const t of teams) {
    tabs.push({ href: href(t.id), label: t.name, active: selected?.id === t.id });
  }
  return tabs;
}

/** UTC Date for IST midnight of a "YYYY-MM-DD" key. */
export function istStartOfDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0) - 330 * 60000);
}

/** Active members of the given teams, alphabetical. */
export async function getMembers(teamIds: string[]) {
  if (teamIds.length === 0) return [];
  return db.user.findMany({
    where: { teamId: { in: teamIds }, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      title: true,
      role: true,
      avatarHue: true,
      teamId: true,
    },
    orderBy: { name: "asc" },
  });
}

export type Member = Awaited<ReturnType<typeof getMembers>>[number];

export const PRESENT_STATUSES = ["PRESENT", "LATE", "HALF_DAY"] as const;

export const OPEN_TASK_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
] as const;
