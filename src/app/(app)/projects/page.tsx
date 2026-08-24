import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { pct, plural } from "@/lib/utils";
import { Card, PanelCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty";
import { Spark } from "@/components/ui/spark";

export const metadata: Metadata = { title: "Projects" };

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PAUSED: 1, ARCHIVED: 2 };

/** Completion bar tinted with the project's hue (inline hsl — data-driven color). */
function HueProgress({ value, hue }: { value: number; hue: number }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${width}%`, backgroundColor: `hsl(${hue} 55% 46%)` }}
      />
    </div>
  );
}

export default async function ProjectsPage() {
  await requireUser();

  const projects = await db.project.findMany({
    include: {
      team: { select: { name: true } },
      tasks: {
        select: {
          id: true,
          status: true,
          assignee: { select: { id: true, name: true, avatarHue: true } },
        },
      },
    },
  });

  const cards = projects
    .map((p) => {
      const total = p.tasks.length;
      const completed = p.tasks.filter((t) => t.status === "COMPLETED").length;
      const active = p.tasks.filter((t) => t.status === "IN_PROGRESS").length;
      const blocked = p.tasks.filter((t) => t.status === "BLOCKED").length;
      const assignees = [
        ...new Map(
          p.tasks
            .filter((t) => t.status !== "COMPLETED")
            .map((t) => [t.assignee.id, t.assignee]),
        ).values(),
      ];
      return { ...p, total, completed, active, blocked, assignees };
    })
    .sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
        a.name.localeCompare(b.name),
    );

  const totals = {
    projects: cards.length,
    activeProjects: cards.filter((p) => p.status === "ACTIVE").length,
    openTasks: cards.reduce((sum, p) => sum + (p.total - p.completed), 0),
    completed: cards.reduce((sum, p) => sum + p.completed, 0),
    all: cards.reduce((sum, p) => sum + p.total, 0),
  };

  return (
    <div>
      <PageHeader
        eyebrow="Company"
        title="Projects"
        description="Everything STAIL is building, and where the work stands."
      />

      {/* Portfolio hero */}
      <PanelCard className="mb-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
            Portfolio
          </p>
          <Spark className="size-5 text-accent" />
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div>
            <p className="text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
              {totals.projects}
            </p>
            <p className="mt-1 text-xs opacity-60">projects</p>
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
              {totals.activeProjects}
            </p>
            <p className="mt-1 text-xs opacity-60">active</p>
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
              {totals.openTasks}
            </p>
            <p className="mt-1 text-xs opacity-60">open tasks</p>
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
              {pct(totals.completed, totals.all)}%
            </p>
            <p className="mt-1 text-xs opacity-60">overall completion</p>
          </div>
        </div>
      </PanelCard>

      {cards.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-5" />}
          title="No projects yet"
          hint="Projects will appear here once they are created."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group block">
              <Card className="flex h-full flex-col gap-4 p-5 transition group-hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: `hsl(${p.hue} 55% 46%)` }}
                      />
                      <h3 className="truncate text-base font-semibold tracking-tight">
                        {p.name}
                      </h3>
                    </div>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                      {p.team?.name ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge tone="outline">{p.code}</Badge>
                    <StatusBadge status={p.status} />
                  </div>
                </div>

                <p className="line-clamp-2 text-sm text-ink-soft">
                  {p.description || "No description yet."}
                </p>

                <div className="mt-auto space-y-4 pt-1">
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        ["Total", p.total, ""],
                        ["Done", p.completed, ""],
                        ["Active", p.active, ""],
                        ["Blocked", p.blocked, p.blocked > 0 ? "text-bad" : ""],
                      ] as const
                    ).map(([label, value, extra]) => (
                      <div key={label}>
                        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                          {label}
                        </p>
                        <p
                          className={`text-lg font-semibold tracking-tight tabular-nums ${extra}`}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-ink-faint">Completion</span>
                      <span className="font-medium tabular-nums">
                        {pct(p.completed, p.total)}%
                      </span>
                    </div>
                    <HueProgress value={pct(p.completed, p.total)} hue={p.hue} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    {p.assignees.length > 0 ? (
                      <AvatarStack
                        people={p.assignees.map((a) => ({
                          name: a.name,
                          hue: a.avatarHue,
                        }))}
                        max={5}
                      />
                    ) : (
                      <span className="text-xs text-ink-faint">No one active</span>
                    )}
                    <span className="text-xs text-ink-faint">
                      {plural(p.assignees.length, "person", "people")} on it
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
