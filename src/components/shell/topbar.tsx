import Link from "next/link";
import { LogOut, Search } from "lucide-react";
import { logout } from "@/app/login/actions";
import type { CurrentUser } from "@/lib/session";
import { ROLE_LABELS, type Role } from "@/lib/definitions";
import { getNotificationsFor } from "@/lib/notifications";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "./brand";
import { LiveClock } from "./live-clock";
import { NotificationsMenu } from "./notifications";

export async function Topbar({ user }: { user: CurrentUser }) {
  const notifications = await getNotificationsFor(user);
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur md:px-8">
      <Link href="/dashboard" className="lg:hidden" aria-label="STAIL dashboard">
        <BrandLogo className="[&_img]:h-5" />
      </Link>

      <form action="/search" className="relative hidden max-w-xs flex-1 md:block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          name="q"
          placeholder="Search people, tasks, projects…"
          className="h-9 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-[13px] outline-none transition placeholder:text-ink-faint focus:border-line-strong focus:ring-2 focus:ring-accent/50"
        />
      </form>

      <div className="ml-auto flex items-center gap-2.5">
        <LiveClock />
        <NotificationsMenu items={notifications} />
        <ThemeToggle />
        <Badge tone="outline" className="hidden sm:inline-flex">
          {ROLE_LABELS[user.role as Role] ?? user.role}
        </Badge>
        <Link href={`/people/${user.id}`} aria-label="My profile">
          <Avatar name={user.name} hue={user.avatarHue} size="md" />
        </Link>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Log out"
            className="inline-flex size-9 items-center justify-center rounded-full border border-line text-ink-soft transition hover:bg-surface-2/70 hover:text-ink"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
