// GET /api/export/attendance?month=YYYY-MM&team=<id>
// CSV export of attendance rows for a month, scoped to the viewer's teams.

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isOrg, visibleTeamIds } from "@/lib/rbac";
import { todayIST } from "@/lib/time";
import { csvResponse, istHM, jsonError, toCsv } from "../csv";

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Not authenticated");
  if (!isOrg(user.role)) return jsonError(403, "Not authorized");

  const params = new URL(request.url).searchParams;
  const monthParam = params.get("month") ?? todayIST().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    return jsonError(400, "Invalid month — expected YYYY-MM");
  }
  const teamParam = params.get("team");

  // Scope teams for the viewer (org roles see everything).
  const scope = await visibleTeamIds(user);
  let teamFilter: string[] | undefined;
  if (scope !== "ALL") {
    if (scope.length === 0) return jsonError(403, "Not authorized");
    teamFilter = scope;
  }
  if (teamParam) {
    if (teamFilter && !teamFilter.includes(teamParam)) {
      return jsonError(403, "Team not in your scope");
    }
    teamFilter = [teamParam];
  }

  const rows = await db.attendance.findMany({
    where: {
      date: { gte: `${monthParam}-01`, lte: `${monthParam}-31` },
      ...(teamFilter ? { user: { teamId: { in: teamFilter } } } : {}),
    },
    include: {
      user: {
        select: {
          name: true,
          employeeCode: true,
          team: { select: { name: true } },
        },
      },
    },
  });

  rows.sort(
    (a, b) =>
      a.user.name.localeCompare(b.user.name) || a.date.localeCompare(b.date),
  );

  const csv = toCsv(
    [
      "employeeCode",
      "name",
      "team",
      "date",
      "status",
      "clockIn",
      "clockOut",
      "breakMinutes",
      "totalMinutes",
      "mode",
    ],
    rows.map((r) => [
      r.user.employeeCode,
      r.user.name,
      r.user.team?.name ?? "",
      r.date,
      r.status,
      istHM(r.clockIn),
      istHM(r.clockOut),
      r.breakMinutes,
      r.totalMinutes,
      r.mode,
    ]),
  );

  return csvResponse(`attendance-${monthParam}.csv`, csv);
}
