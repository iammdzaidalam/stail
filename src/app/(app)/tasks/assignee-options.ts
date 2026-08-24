import { db } from "@/lib/db";
import { isManagerial, isOrg, visibleTeamIds } from "@/lib/rbac";

export type AssigneeGroup = {
  label: string;
  members: { id: string; name: string }[];
};

type UserLike = { id: string; name: string; role: string; teamId?: string | null };

/**
 * Assignee choices for the task forms, grouped by team.
 * - Non-managerial roles get `null` (they always self-assign; no field shown).
 * - TEAM_LEAD: self + active members of their visible teams.
 * - Org roles (MANAGER/HR/FOUNDER): every active user, grouped by team.
 * `ensure` forces one extra person (e.g. the current assignee on edit) into
 * the list so the select never loses its value.
 */
export async function assigneeGroups(
  user: UserLike,
  ensure?: { id: string; name: string },
): Promise<AssigneeGroup[] | null> {
  if (!isManagerial(user.role)) return null;

  const ids = await visibleTeamIds(user);
  const teams = await db.team.findMany({
    where: ids === "ALL" ? {} : { id: { in: ids } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      members: {
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  const groups: AssigneeGroup[] = teams
    .filter((t) => t.members.length > 0)
    .map((t) => ({ label: t.name, members: t.members }));

  if (isOrg(user.role)) {
    const unassigned = await db.user.findMany({
      where: { status: "ACTIVE", teamId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    if (unassigned.length > 0) groups.push({ label: "No team", members: unassigned });
  }

  const present = new Set(groups.flatMap((g) => g.members.map((m) => m.id)));
  if (!present.has(user.id)) {
    groups.unshift({ label: "Me", members: [{ id: user.id, name: user.name }] });
    present.add(user.id);
  }
  if (ensure && !present.has(ensure.id)) {
    groups.unshift({ label: "Current assignee", members: [ensure] });
  }
  return groups;
}
