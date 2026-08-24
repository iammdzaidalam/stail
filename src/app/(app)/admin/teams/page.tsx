import type { Metadata } from "next";
import Link from "next/link";
import { Check, Pencil, Trash2, Users, X } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { plural } from "@/lib/utils";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Card, PanelCard } from "@/components/ui/card";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty";
import { NoticeBanner } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import { Spark } from "@/components/ui/spark";
import { deleteTeam } from "./actions";
import { TeamForm } from "./team-form";

export const metadata: Metadata = { title: "Teams" };

const NOTICES: Record<string, { tone: "good" | "warn" | "bad"; text: string }> = {
  "done:deleted": { tone: "good", text: "Team deleted." },
  "problem:gone": { tone: "warn", text: "That team no longer exists." },
  "problem:not-empty": {
    tone: "bad",
    text: "Only empty teams can be deleted — move its members, projects and tasks first.",
  },
};

export default async function TeamsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const confirmId = typeof sp.confirm === "string" ? sp.confirm : null;
  const editId = typeof sp.edit === "string" ? sp.edit : null;
  const notice =
    typeof sp.done === "string"
      ? NOTICES[`done:${sp.done}`]
      : typeof sp.problem === "string"
        ? NOTICES[`problem:${sp.problem}`]
        : null;

  const [teams, people] = await Promise.all([
    db.team.findMany({
      orderBy: { name: "asc" },
      include: {
        lead: { select: { name: true } },
        manager: { select: { name: true } },
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
      },
    }),
    db.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, title: true },
    }),
  ]);
  const editing = editId ? (teams.find((t) => t.id === editId) ?? null) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Teams"
        description="Create teams, assign leads and managers — approvals and team dashboards follow this structure."
      />

      {notice && (
        <NoticeBanner tone={notice.tone} dismissHref="/admin/teams">
          {notice.text}
        </NoticeBanner>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="min-w-0">
          <PanelCard className="mb-4 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
                Teams
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
                {teams.length}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs opacity-60">
              <Spark className="size-4" />
              Assign people to teams from their profile
            </div>
          </PanelCard>

          {teams.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No teams yet"
              hint="Create the first team with the form — then assign people to it when approving registrations or editing profiles."
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Team</Th>
                    <Th>Department</Th>
                    <Th>Lead</Th>
                    <Th>Manager</Th>
                    <Th className="text-right">Members</Th>
                    <Th className="w-20 text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <Tr key={t.id}>
                      <Td className="font-medium">{t.name}</Td>
                      <Td className="text-ink-soft">{t.department}</Td>
                      <Td className="text-ink-soft">{t.lead?.name ?? "—"}</Td>
                      <Td className="text-ink-soft">{t.manager?.name ?? "—"}</Td>
                      <Td className="text-right tabular-nums">{t._count.members}</Td>
                      <Td className="text-right">
                        {confirmId === t.id ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-xs text-bad">Delete?</span>
                            <form action={deleteTeam} className="inline-block">
                              <input type="hidden" name="id" value={t.id} />
                              <SubmitButton variant="danger" size="sm">
                                <Check className="size-3.5" /> Yes
                              </SubmitButton>
                            </form>
                            <Link
                              href="/admin/teams"
                              className={buttonClass({ variant: "outline", size: "sm" })}
                            >
                              <X className="size-3.5" /> No
                            </Link>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Link
                              href={`/admin/teams?edit=${t.id}`}
                              aria-label={`Edit ${t.name}`}
                              className={buttonClass({
                                variant: "ghost",
                                size: "icon",
                                className: "size-8 text-ink-faint hover:text-ink",
                              })}
                            >
                              <Pencil className="size-4" />
                            </Link>
                            <Link
                              href={`/admin/teams?confirm=${t.id}`}
                              aria-label={`Delete ${t.name}`}
                              className={buttonClass({
                                variant: "ghost",
                                size: "icon",
                                className: "size-8 text-ink-faint hover:text-bad",
                              })}
                            >
                              <Trash2 className="size-4" />
                            </Link>
                          </span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </div>

        <Card className="p-6">
          <SectionTitle
            title={editing ? `Edit ${editing.name}` : "Create team"}
            className="mb-5"
            action={
              editing ? (
                <Link
                  href="/admin/teams"
                  className="text-xs font-medium text-ink-soft hover:text-ink"
                >
                  New team instead
                </Link>
              ) : undefined
            }
          />
          <TeamForm
            key={editing?.id ?? "new"}
            team={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    department: editing.department,
                    leadId: editing.leadId,
                    managerId: editing.managerId,
                  }
                : undefined
            }
            people={people}
          />
          {!editing && (
            <p className="mt-4 border-t border-line pt-3.5 text-xs text-ink-faint">
              {plural(people.length, "active person", "active people")} available
              to assign as lead or manager.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
