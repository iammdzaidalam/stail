import type { Metadata } from "next";
import Link from "next/link";
import { Check, Trash2, UserPlus, X } from "lucide-react";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/definitions";
import { timeAgo } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard } from "@/components/ui/card";
import { Card, CardLabel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { NoticeBanner } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty";
import { Spark } from "@/components/ui/spark";
import { buttonClass } from "@/components/ui/button";
import {
  approveRegistration,
  deleteRegistration,
  rejectRegistration,
} from "./actions";

export const metadata: Metadata = { title: "Registrations" };

const NOTICES: Record<string, { tone: "good" | "warn" | "bad"; text: string }> = {
  "done:approved": {
    tone: "good",
    text: "Registration approved — they can sign in now.",
  },
  "done:rejected": {
    tone: "good",
    text: "Registration declined. You can delete it below to free the email for a fresh registration.",
  },
  "done:deleted": {
    tone: "good",
    text: "Registration removed — that email can register again.",
  },
  "problem:gone": {
    tone: "warn",
    text: "That registration was already handled (possibly by another admin).",
  },
  "problem:role": { tone: "bad", text: "Pick a valid role before approving." },
  "problem:team": { tone: "bad", text: "That team no longer exists — pick another." },
};

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser(["HR", "FOUNDER", "SUPER_ADMIN"]);
  const sp = await searchParams;
  const confirmId = typeof sp.confirm === "string" ? sp.confirm : null;
  const notice =
    typeof sp.done === "string"
      ? NOTICES[`done:${sp.done}`]
      : typeof sp.problem === "string"
        ? NOTICES[`problem:${sp.problem}`]
        : null;

  const [pending, rejected, teams] = await Promise.all([
    db.user.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({
      where: { status: "REJECTED" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Registrations"
        description="Everyone who signs up waits here until you approve them, assign a role and (optionally) a team."
      />

      {notice && (
        <NoticeBanner tone={notice.tone} dismissHref="/admin/registrations">
          {notice.text}
        </NoticeBanner>
      )}

      <PanelCard className="mb-6 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-60">
            Awaiting approval
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
            {pending.length}
          </p>
          <p className="mt-1.5 text-sm opacity-60">
            {pending.length === 0
              ? "Nobody is waiting right now."
              : "Approve to activate the account, or decline it."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs opacity-60">
          <Spark className="size-4" />
          New people register themselves at /register
        </div>
      </PanelCard>

      {pending.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="size-6" />}
          title="No pending registrations"
          hint="Share the register link with new joiners — their requests will land here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <Avatar name={p.name} hue={p.avatarHue} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {p.name}
                        <Badge tone="outline">{p.employeeCode}</Badge>
                      </p>
                      <p className="mt-0.5 break-all text-xs text-ink-soft">
                        {p.email}
                        {p.title ? ` · applied as ${p.title}` : ""}
                        {p.phone ? ` · ${p.phone}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-ink-faint">
                    registered {timeAgo(p.createdAt)}
                  </span>
                </div>

                <form
                  action={approveRegistration}
                  className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                    <Select
                      name="role"
                      defaultValue="EMPLOYEE"
                      aria-label={`Role for ${p.name}`}
                      className="sm:max-w-44"
                    >
                      {ROLES.filter((r) => r !== "SUPER_ADMIN").map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r as Role]}
                        </option>
                      ))}
                    </Select>
                    <Select
                      name="teamId"
                      defaultValue=""
                      aria-label={`Team for ${p.name}`}
                      className="sm:max-w-56"
                    >
                      <option value="">No team yet</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SubmitButton variant="accent" size="sm" pendingLabel="Saving…">
                      <Check className="size-3.5" /> Approve
                    </SubmitButton>
                    <SubmitButton
                      formAction={rejectRegistration}
                      variant="outline"
                      size="sm"
                      pendingLabel="Saving…"
                    >
                      <X className="size-3.5" /> Decline
                    </SubmitButton>
                  </div>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="mt-8">
          <CardLabel className="mb-3">Declined registrations</CardLabel>
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {rejected.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <Avatar name={p.name} hue={p.avatarHue} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-ink-faint">{p.email}</p>
                  </div>
                  <StatusBadge status="REJECTED" />
                  {confirmId === p.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-xs text-bad">Delete forever?</span>
                      <form action={deleteRegistration} className="inline-block">
                        <input type="hidden" name="id" value={p.id} />
                        <SubmitButton variant="danger" size="sm">
                          <Check className="size-3.5" /> Yes
                        </SubmitButton>
                      </form>
                      <Link
                        href="/admin/registrations"
                        className={buttonClass({ variant: "outline", size: "sm" })}
                      >
                        <X className="size-3.5" /> No
                      </Link>
                    </span>
                  ) : (
                    <Link
                      href={`/admin/registrations?confirm=${p.id}`}
                      aria-label={`Delete registration of ${p.name}`}
                      className={buttonClass({
                        variant: "ghost",
                        size: "icon",
                        className: "size-8 text-ink-faint hover:text-bad",
                      })}
                    >
                      <Trash2 className="size-4" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <p className="mt-2.5 text-xs text-ink-faint">
            Deleting a declined registration frees the email so the person can
            register again.
          </p>
        </div>
      )}
    </div>
  );
}
