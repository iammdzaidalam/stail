import Link from "next/link";
import { Download, Plus, Search, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import {
  EMPLOYMENT_TYPE_LABELS,
  ROLE_LABELS,
  type EmploymentType,
  type Role,
} from "@/lib/definitions";
import { dateKey, fmtDateFull, todayIST } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { LinkTabs } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Button, buttonClass } from "@/components/ui/button";

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function peopleHref(params: { q?: string; team?: string; status?: string }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.team) sp.set("team", params.team);
  if (params.status) sp.set("status", params.status);
  const qs = sp.toString();
  return qs ? `/people?${qs}` : "/people";
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireUser(["MANAGER", "HR", "FOUNDER"]);
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 100);
  const teamParam = first(sp.team);
  const statusParam = first(sp.status) || "ACTIVE";

  const teams = await db.team.findMany({ orderBy: { name: "asc" } });
  const validTeam = teams.some((t) => t.id === teamParam) ? teamParam : "";

  const people = await db.user.findMany({
    where: {
      ...(statusParam === "all" ? {} : { status: statusParam === "EXITED" ? "EXITED" : "ACTIVE" }),
      ...(validTeam ? { teamId: validTeam } : {}),
      ...(q ? { name: { contains: q } } : {}),
    },
    include: {
      team: { select: { name: true } },
      manager: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  // Org-wide headline stats (independent of filters).
  const active = await db.user.findMany({
    where: { status: "ACTIVE" },
    select: { employmentType: true },
  });
  const fullTime = active.filter((u) => u.employmentType === "FULL_TIME").length;
  const interns = active.filter((u) => u.employmentType === "INTERN").length;

  const month = todayIST().slice(0, 7);
  const exportHref = `/api/export/attendance?month=${month}${validTeam ? `&team=${validTeam}` : ""}`;

  const statusTabs = [
    { key: "ACTIVE", label: "Active" },
    { key: "EXITED", label: "Exited" },
    { key: "all", label: "All" },
  ].map((t) => ({
    href: peopleHref({ q, team: validTeam, status: t.key === "ACTIVE" ? "" : t.key }),
    label: t.label,
    active: statusParam === t.key,
  }));

  const teamTabs = [
    {
      href: peopleHref({ q, status: statusParam === "ACTIVE" ? "" : statusParam }),
      label: "All teams",
      active: !validTeam,
    },
    ...teams.map((t) => ({
      href: peopleHref({
        q,
        team: t.id,
        status: statusParam === "ACTIVE" ? "" : statusParam,
      }),
      label: t.name,
      active: validTeam === t.id,
    })),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Company"
        title="People"
        description="The full directory — everyone at STAIL, their team, role and manager."
        actions={
          <>
            <a href={exportHref} className={buttonClass({ variant: "outline", size: "sm" })}>
              <Download className="size-4" />
              Export CSV
            </a>
            {isAdmin(viewer.role) && (
              <Link href="/people/new" className={buttonClass({ variant: "accent", size: "sm" })}>
                <Plus className="size-4" />
                Add person
              </Link>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="panel" label="Total active" value={active.length} sub="people on the roster" />
        <StatCard label="Full-time" value={fullTime} sub="permanent employees" />
        <StatCard label="Interns" value={interns} sub="currently active" />
        <StatCard label="Teams" value={teams.length} sub="across the company" />
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <LinkTabs tabs={teamTabs} />
          <LinkTabs tabs={statusTabs} />
        </div>
        <form action="/people" method="GET" className="relative w-full xl:w-64">
          {validTeam && <input type="hidden" name="team" value={validTeam} />}
          {statusParam !== "ACTIVE" && <input type="hidden" name="status" value={statusParam} />}
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name…"
            className="pl-10"
            aria-label="Search people by name"
          />
          <Button type="submit" className="sr-only">
            Search
          </Button>
        </form>
      </div>

      {people.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-6" />}
          title="No people match these filters"
          hint={
            q
              ? `Nothing found for “${q}”. Try a different name or clear the filters.`
              : "Try a different team or status filter."
          }
          action={
            <Link href="/people" className={buttonClass({ variant: "outline", size: "sm" })}>
              Clear filters
            </Link>
          }
        />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Title</Th>
                <Th>Team</Th>
                <Th>Role</Th>
                <Th>Type</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
                <Th>Manager</Th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <Link href={`/people/${p.id}`} className="group flex items-center gap-3">
                      <Avatar name={p.name} hue={p.avatarHue} size="md" />
                      <span>
                        <span className="block text-sm font-medium tracking-tight group-hover:underline">
                          {p.name}
                        </span>
                        <span className="block font-mono text-[11px] text-ink-faint">
                          {p.employeeCode}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-ink-soft">{p.title ?? "—"}</Td>
                  <Td className="text-ink-soft">{p.team?.name ?? "—"}</Td>
                  <Td>
                    <Badge tone="outline">{ROLE_LABELS[p.role as Role] ?? p.role}</Badge>
                  </Td>
                  <Td className="text-ink-soft">
                    {EMPLOYMENT_TYPE_LABELS[p.employmentType as EmploymentType] ??
                      p.employmentType}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-ink-soft">
                    {fmtDateFull(dateKey(p.joiningDate))}
                  </Td>
                  <Td>
                    <StatusBadge status={p.status} />
                  </Td>
                  <Td className="text-ink-soft">{p.manager?.name ?? "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
