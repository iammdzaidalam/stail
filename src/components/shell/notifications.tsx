"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlarmClock,
  Bell,
  CalendarRange,
  Inbox,
  ListTodo,
  Megaphone,
  NotebookPen,
  Pencil,
  TreePalm,
  type LucideIcon,
} from "lucide-react";
import type { AppNotification, NotificationIcon } from "@/lib/notifications";
import { Spark } from "@/components/ui/spark";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationIcon, LucideIcon> = {
  clock: AlarmClock,
  plan: ListTodo,
  report: NotebookPen,
  inbox: Inbox,
  leave: TreePalm,
  correction: Pencil,
  holiday: CalendarRange,
  announcement: Megaphone,
};

const TONE_STYLES: Record<AppNotification["tone"], string> = {
  accent: "bg-accent text-accent-ink",
  warn: "bg-warn/15 text-warn",
  good: "bg-good/15 text-good",
  bad: "bg-bad/12 text-bad",
  neutral: "bg-surface-2 text-ink-soft",
};

export function NotificationsMenu({ items }: { items: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const actionCount = items.filter((n) => n.kind === "action").length;

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const actions = items.filter((n) => n.kind === "action");
  const updates = items.filter((n) => n.kind === "update");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={
          actionCount > 0
            ? `Notifications — ${actionCount} need${actionCount === 1 ? "s" : ""} action`
            : "Notifications"
        }
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex size-9 items-center justify-center rounded-full border transition",
          open
            ? "border-line-strong bg-surface-2/70 text-ink"
            : "border-line text-ink-soft hover:bg-surface-2/70 hover:text-ink",
        )}
      >
        <Bell className="size-4" />
        {actionCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-ink ring-2 ring-bg">
            {actionCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="fixed inset-x-4 top-[4.25rem] z-40 overflow-hidden rounded-3xl border border-line bg-surface shadow-lg shadow-ink/5 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              Notifications
            </p>
            {actionCount > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
                {actionCount} to do
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Spark className="size-5 text-accent" />
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs text-ink-faint">
                Nothing needs your attention right now.
              </p>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {actions.length > 0 && (
                <Group label="Needs action" items={actions} onNavigate={() => setOpen(false)} />
              )}
              {updates.length > 0 && (
                <Group label="Updates" items={updates} onNavigate={() => setOpen(false)} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: AppNotification[];
  onNavigate: () => void;
}) {
  return (
    <div className="py-1.5">
      <p className="px-3.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </p>
      <ul>
        {items.map((n) => {
          const Icon = ICONS[n.icon];
          return (
            <li key={n.id}>
              <Link
                href={n.href}
                onClick={onNavigate}
                className="flex gap-3 rounded-2xl px-3.5 py-3 transition hover:bg-surface-2/60"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                    TONE_STYLES[n.tone],
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium leading-snug">
                      {n.title}
                    </span>
                    {n.meta && (
                      <span className="shrink-0 text-[10px] text-ink-faint">
                        {n.meta}
                      </span>
                    )}
                  </span>
                  {n.body && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                      {n.body}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
