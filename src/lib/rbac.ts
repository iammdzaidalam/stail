import { db } from "./db";
import {
  ADMIN_ROLES,
  MANAGERIAL_ROLES,
  ORG_ROLES,
  type Role,
} from "./definitions";

type UserLike = { id: string; role: string; teamId?: string | null };

export function isManagerial(role: string): boolean {
  return MANAGERIAL_ROLES.includes(role as Role);
}

/** Org-wide read access (cross-team dashboards, reports). */
export function isOrg(role: string): boolean {
  return ORG_ROLES.includes(role as Role);
}

/** Administrative powers: people, teams, policies, holidays, audit. */
export function isAdmin(role: string): boolean {
  return ADMIN_ROLES.includes(role as Role);
}

/**
 * Which teams this user may see at team level.
 * "ALL" for org-wide roles; a concrete id list for team leads;
 * [] for employees/interns.
 */
export async function visibleTeamIds(user: UserLike): Promise<"ALL" | string[]> {
  if (isOrg(user.role)) return "ALL";
  if (user.role === "TEAM_LEAD") {
    const led = await db.team.findMany({
      where: { OR: [{ leadId: user.id }, { managerId: user.id }] },
      select: { id: true },
    });
    const ids = new Set(led.map((t) => t.id));
    if (user.teamId) ids.add(user.teamId);
    return [...ids];
  }
  return [];
}

/** Resolve a Prisma `where` fragment scoping users to the viewer's teams. */
export async function teamScopeWhere(
  user: UserLike,
): Promise<{ teamId?: { in: string[] } } | null> {
  const ids = await visibleTeamIds(user);
  if (ids === "ALL") return {};
  if (ids.length === 0) return null;
  return { teamId: { in: ids } };
}

/** May `viewer` see `target`'s work data (attendance, tasks, reports)? */
export async function canViewUser(viewer: UserLike, targetId: string): Promise<boolean> {
  if (viewer.id === targetId) return true;
  if (isOrg(viewer.role)) return true;
  if (!isManagerial(viewer.role)) return false;
  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { teamId: true, managerId: true },
  });
  if (!target) return false;
  if (target.managerId === viewer.id) return true;
  const ids = await visibleTeamIds(viewer);
  return ids !== "ALL" && target.teamId != null && ids.includes(target.teamId);
}
