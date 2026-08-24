import type { Metadata } from "next";
import Link from "next/link";
import { Check, Megaphone, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, PanelCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { isAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { dateKey, fmtDateFull, fmtTime, timeAgo } from "@/lib/time";
import { deleteAnnouncement } from "./actions";
import { AnnouncementComposer } from "./composer";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const admin = isAdmin(user.role);
  const sp = await searchParams;
  const confirmId = typeof sp.confirm === "string" ? sp.confirm : null;

  const announcements = await db.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: { name: true, avatarHue: true, title: true } } },
  });

  const [latest, ...rest] = announcements;

  return (
    <div>
      <PageHeader
        eyebrow="Company"
        title="Announcements"
        description="Everything STAIL needs to know, in one place — newest first."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {announcements.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="size-5" />}
              title="No announcements yet"
              hint="When leadership posts one, it shows up here and in everyone's notifications."
            />
          ) : (
            <>
              {/* Latest announcement gets the feature panel */}
              <PanelCard className="p-7">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-60">
                  Latest · {timeAgo(latest.createdAt)}
                </p>
                <h2 className="mt-3 text-xl font-semibold tracking-tight md:text-2xl">
                  {latest.title}
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed opacity-80">
                  {latest.body}
                </p>
                <AnnouncementFooter a={latest} admin={admin} confirming={confirmId === latest.id} onPanel />
              </PanelCard>

              {rest.map((a) => (
                <Card key={a.id} className="p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-base font-semibold tracking-tight">
                      {a.title}
                    </h3>
                    <span className="shrink-0 text-[11px] text-ink-faint">
                      {timeAgo(a.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                    {a.body}
                  </p>
                  <AnnouncementFooter a={a} admin={admin} confirming={confirmId === a.id} />
                </Card>
              ))}
            </>
          )}
        </div>

        <div className="space-y-4">
          {admin && <AnnouncementComposer />}
          <Card className="p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              How this works
            </p>
            <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">
              Announcements reach everyone: the two most recent appear on each
              person&apos;s dashboard, and anything posted in the last week
              shows in the notification bell.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AnnouncementFooter({
  a,
  admin,
  confirming = false,
  onPanel = false,
}: {
  a: {
    id: string;
    createdAt: Date;
    author: { name: string; avatarHue: number; title: string | null } | null;
  };
  admin: boolean;
  confirming?: boolean;
  onPanel?: boolean;
}) {
  return (
    <div
      className={
        onPanel
          ? "mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-panel-line pt-4"
          : "mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5"
      }
    >
      <div className="flex items-center gap-2.5">
        {a.author ? (
          <>
            <Avatar name={a.author.name} hue={a.author.avatarHue} size="sm" />
            <span className="text-xs">
              <span className="font-medium">{a.author.name}</span>
              <span className={onPanel ? "opacity-60" : "text-ink-faint"}>
                {a.author.title ? ` · ${a.author.title}` : ""}
              </span>
            </span>
          </>
        ) : (
          <span className={onPanel ? "text-xs opacity-60" : "text-xs text-ink-faint"}>
            STAIL
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className={onPanel ? "text-[11px] opacity-50" : "text-[11px] text-ink-faint"}>
          {fmtDateFull(dateKey(a.createdAt))} · {fmtTime(a.createdAt)}
        </span>
        {admin &&
          (confirming ? (
            <span className="inline-flex items-center gap-1.5">
              <span className={onPanel ? "text-xs text-bad" : "text-xs text-bad"}>
                Delete?
              </span>
              <form action={deleteAnnouncement} className="inline-block">
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  aria-label="Confirm delete"
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-bad px-2.5 text-xs font-medium text-white transition hover:opacity-90"
                >
                  <Check className="size-3" /> Yes
                </button>
              </form>
              <Link
                href="/announcements"
                aria-label="Cancel delete"
                className={
                  onPanel
                    ? "inline-flex h-7 items-center gap-1 rounded-full border border-panel-line px-2.5 text-xs opacity-80 transition hover:opacity-100"
                    : "inline-flex h-7 items-center gap-1 rounded-full border border-line px-2.5 text-xs text-ink-soft transition hover:text-ink"
                }
              >
                <X className="size-3" /> No
              </Link>
            </span>
          ) : (
            <Link
              href={`/announcements?confirm=${a.id}`}
              aria-label="Delete announcement"
              className={
                onPanel
                  ? "inline-flex size-7 items-center justify-center rounded-full border border-panel-line opacity-60 transition hover:opacity-100"
                  : "inline-flex size-7 items-center justify-center rounded-full border border-line text-ink-faint transition hover:text-bad"
              }
            >
              <Trash2 className="size-3.5" />
            </Link>
          ))}
      </div>
    </div>
  );
}
