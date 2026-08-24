import type { Metadata } from "next";
import Link from "next/link";
import {
  FolderKanban,
  ListChecks,
  NotebookPen,
  Search,
  UsersRound,
  Users,
} from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { isManagerial, isOrg, visibleTeamIds } from "@/lib/rbac";
import { addDays, fmtDateFull, todayIST } from "@/lib/time";
import { ROLE_LABELS, type Role } from "@/lib/definitions";
import { plural } from "@/lib/utils";
import { Card, PanelCard } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spark } from "@/components/ui/spark";

export const metadata: Metadata = { title: "Search" };

const GROUP_LIMIT = 10;

function MoreNote({ total }: { total: number }) {
  if (total <= GROUP_LIMIT) return null;
  return (
    <p className="px-5 py-3 text-xs text-ink-faint">
      +{total - GROUP_LIMIT} more — refine your search to narrow it down.
    </p>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const q = (raw ?? "").trim().slice(0, 100);

  const searchForm = (
    <form action="/search" className="mb-6 flex max-w-xl gap-2.5">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search people, teams, projects, tasks, reports…"
          className="rounded-full pl-10"
          autoFocus
        />
      </div>
      <Button type="submit" variant="primary">
        Search
      </Button>
    </form>
  );

  if (!q) {
    return (
      <div>
        <PageHeader
          eyebrow="Everywhere"
          title="Search"
          description="One box for the whole workspace."
        />
        {searchForm}
        <EmptyState
          icon={<Search className="size-6" />}
          title="Search across STAIL"
          hint="Try a person's name, a project code like the ones on project cards, a task keyword, or a phrase from a daily report. Results are grouped and respect what you're allowed to see."
        />
      </div>
    );
  }

  // ---- RBAC scopes ---------------------------------------------------------
  const managerial = isManagerial(user.role);
  const org = isOrg(user.role);
  const teamIds = org ? "ALL" : await visibleTeamIds(user);

  const taskScope: Prisma.TaskWhereInput = org
    ? {}
    : user.role === "TEAM_LEAD"
      ? {
          OR: [
            { teamId: { in: teamIds === "ALL" ? [] : teamIds } },
            { assigneeId: user.id },
          ],
        }
      : { assigneeId: user.id };

  const reportScope: Prisma.DailyReportWhereInput = org
    ? {}
    : user.role === "TEAM_LEAD"
      ? {
          OR: [
            { user: { teamId: { in: teamIds === "ALL" ? [] : teamIds } } },
            { userId: user.id },
          ],
        }
      : { userId: user.id };

  const peopleWhere: Prisma.UserWhereInput = {
    status: "ACTIVE",
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
    ],
  };
  const teamWhere: Prisma.TeamWhereInput = { name: { contains: q, mode: "insensitive" } };
  const projectWhere: Prisma.ProjectWhereInput = {
    OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }],
  };
  const taskWhere: Prisma.TaskWhereInput = {
    AND: [
      { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] },
      taskScope,
    ],
  };
  const reportWhere: Prisma.DailyReportWhereInput = {
    AND: [
      { OR: [{ accomplishments: { contains: q, mode: "insensitive" } }, { blockers: { contains: q, mode: "insensitive" } }] },
      reportScope,
      // Non-managerial hits land on /reports?tab=history (last 30 days) —
      // don't surface results that destination can't display.
      ...(managerial ? [] : [{ date: { gte: addDays(todayIST(), -30) } }]),
    ],
  };

  const [
    people,
    peopleCount,
    teams,
    teamsCount,
    projects,
    projectsCount,
    tasks,
    tasksCount,
    reports,
    reportsCount,
  ] = await Promise.all([
    db.user.findMany({
      where: peopleWhere,
      select: {
        id: true,
        name: true,
        title: true,
        avatarHue: true,
        role: true,
        teamId: true,
        managerId: true,
        team: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: GROUP_LIMIT,
    }),
    db.user.count({ where: peopleWhere }),
    db.team.findMany({
      where: teamWhere,
      select: {
        id: true,
        name: true,
        department: true,
        lead: { select: { name: true, avatarHue: true } },
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { name: "asc" },
      take: GROUP_LIMIT,
    }),
    db.team.count({ where: teamWhere }),
    db.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        hue: true,
        team: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: GROUP_LIMIT,
    }),
    db.project.count({ where: projectWhere }),
    db.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        assignee: { select: { name: true, avatarHue: true } },
        project: { select: { code: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: GROUP_LIMIT,
    }),
    db.task.count({ where: taskWhere }),
    db.dailyReport.findMany({
      where: reportWhere,
      select: {
        id: true,
        date: true,
        accomplishments: true,
        blockers: true,
        user: { select: { name: true, avatarHue: true } },
      },
      orderBy: { date: "desc" },
      take: GROUP_LIMIT,
    }),
    db.dailyReport.count({ where: reportWhere }),
  ]);

  const totalResults =
    peopleCount + teamsCount + projectsCount + tasksCount + reportsCount;
  const groups: [string, number][] = [
    ["People", peopleCount],
    ["Teams", teamsCount],
    ["Projects", projectsCount],
    ["Tasks", tasksCount],
    ["Reports", reportsCount],
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Everywhere"
        title="Search"
        description="One box for the whole workspace."
      />
      {searchForm}

      <PanelCard className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
            Results
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tighter tabular-nums md:text-5xl">
            {totalResults}
          </p>
          <p className="mt-1.5 text-sm opacity-60">
            for &ldquo;{q}&rdquo;
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs tabular-nums opacity-70">
          {groups.map(([label, count], i) => (
            <span key={label} className="flex items-center gap-4">
              {i > 0 && <span className="opacity-40">·</span>}
              <span>
                {label} <span className="font-semibold">{count}</span>
              </span>
            </span>
          ))}
          <Spark className="ml-1 size-4 text-accent" />
        </div>
      </PanelCard>

      {totalResults === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title={`Nothing found for "${q}"`}
          hint="Check the spelling, try a shorter keyword, or search a project code or person's name. Tasks and reports only show what you're allowed to see."
        />
      ) : (
        <div className="space-y-8">
          {people.length > 0 && (
            <section>
              <SectionTitle
                title={
                  <span className="flex items-center gap-2.5">
                    <UsersRound className="size-4 text-ink-faint" /> People
                    <Badge tone="neutral">{peopleCount}</Badge>
                  </span>
                }
              />
              <Card className="p-0">
                <div className="divide-y divide-line">
                  {people.map((p) => {
                    // Only link where the profile page would actually let the
                    // viewer in (self, org roles, own teams, direct reports).
                    const canOpen =
                      org ||
                      p.id === user.id ||
                      p.managerId === user.id ||
                      (Array.isArray(teamIds) &&
                        p.teamId != null &&
                        teamIds.includes(p.teamId));
                    const row = (
                      <>
                        <Avatar name={p.name} hue={p.avatarHue} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="truncate text-xs text-ink-faint">
                            {[p.title, p.team?.name]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                        <Badge tone="outline" className="hidden sm:inline-flex">
                          {ROLE_LABELS[p.role as Role] ?? p.role}
                        </Badge>
                      </>
                    );
                    return canOpen ? (
                      <Link
                        key={p.id}
                        href={`/people/${p.id}`}
                        className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-surface-2/40"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div
                        key={p.id}
                        className="flex items-center gap-3.5 px-5 py-3.5"
                      >
                        {row}
                      </div>
                    );
                  })}
                </div>
                <MoreNote total={peopleCount} />
              </Card>
            </section>
          )}

          {teams.length > 0 && (
            <section>
              <SectionTitle
                title={
                  <span className="flex items-center gap-2.5">
                    <Users className="size-4 text-ink-faint" /> Teams
                    <Badge tone="neutral">{teamsCount}</Badge>
                  </span>
                }
              />
              <Card className="p-0">
                <div className="divide-y divide-line">
                  {teams.map((t) => {
                    const inner = (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.name}</p>
                          <p className="truncate text-xs text-ink-faint">
                            {t.department}
                            {t.lead ? ` · led by ${t.lead.name}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                          {plural(t._count.members, "member")}
                        </span>
                      </>
                    );
                    return managerial ? (
                      <Link
                        key={t.id}
                        href={`/team?team=${t.id}`}
                        className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-surface-2/40"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div key={t.id} className="flex items-center gap-3.5 px-5 py-3.5">
                        {inner}
                      </div>
                    );
                  })}
                </div>
                <MoreNote total={teamsCount} />
              </Card>
            </section>
          )}

          {projects.length > 0 && (
            <section>
              <SectionTitle
                title={
                  <span className="flex items-center gap-2.5">
                    <FolderKanban className="size-4 text-ink-faint" /> Projects
                    <Badge tone="neutral">{projectsCount}</Badge>
                  </span>
                }
              />
              <Card className="p-0">
                <div className="divide-y divide-line">
                  {projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-surface-2/40"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: `hsl(${p.hue} 55% 46%)` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {p.code}
                          {p.team ? ` · ${p.team.name}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={p.status} />
                    </Link>
                  ))}
                </div>
                <MoreNote total={projectsCount} />
              </Card>
            </section>
          )}

          {tasks.length > 0 && (
            <section>
              <SectionTitle
                title={
                  <span className="flex items-center gap-2.5">
                    <ListChecks className="size-4 text-ink-faint" /> Tasks
                    <Badge tone="neutral">{tasksCount}</Badge>
                  </span>
                }
              />
              <Card className="p-0">
                <div className="divide-y divide-line">
                  {tasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-surface-2/40"
                    >
                      <Avatar
                        name={t.assignee.name}
                        hue={t.assignee.avatarHue}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {t.assignee.name}
                          {t.project ? ` · ${t.project.code}` : ""}
                        </p>
                      </div>
                      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                        <StatusBadge status={t.priority} />
                        <StatusBadge status={t.status} />
                      </span>
                    </Link>
                  ))}
                </div>
                <MoreNote total={tasksCount} />
              </Card>
            </section>
          )}

          {reports.length > 0 && (
            <section>
              <SectionTitle
                title={
                  <span className="flex items-center gap-2.5">
                    <NotebookPen className="size-4 text-ink-faint" /> Daily reports
                    <Badge tone="neutral">{reportsCount}</Badge>
                  </span>
                }
              />
              <Card className="p-0">
                <div className="divide-y divide-line">
                  {reports.map((r) => (
                    <Link
                      key={r.id}
                      href={
                        managerial
                          ? `/team/reports?date=${r.date}`
                          : "/reports?tab=history"
                      }
                      className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-surface-2/40"
                    >
                      <Avatar name={r.user.name} hue={r.user.avatarHue} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {r.user.name}
                          <span className="font-normal text-ink-faint">
                            {" "}
                            · {fmtDateFull(r.date)}
                          </span>
                        </p>
                        <p className="truncate text-xs text-ink-faint">
                          {(r.blockers?.includes(q) && !r.accomplishments.includes(q)
                            ? r.blockers
                            : r.accomplishments
                          )
                            .replaceAll("\n", " ")
                            .slice(0, 140)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                <MoreNote total={reportsCount} />
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
