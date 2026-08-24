"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu as MenuIcon, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/definitions";
import { ROLE_LABELS } from "@/lib/definitions";
import { Avatar } from "@/components/ui/avatar";
import { BrandLogo } from "./brand";
import { sectionsForRole } from "./nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/team") return pathname === "/team";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({
  role,
  user,
}: {
  role: Role;
  user: { id: string; name: string; hue: number; title: string | null };
}) {
  const pathname = usePathname();
  const sections = sectionsForRole(role);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-line bg-bg lg:flex">
      <div className="px-6 pb-2 pt-6">
        <Link href="/dashboard" aria-label="STAIL dashboard">
          <BrandLogo />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3.5 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-full px-3.5 py-2 text-[13px] font-medium transition",
                        active
                          ? "bg-ink text-bg"
                          : "text-ink-soft hover:bg-surface-2/70 hover:text-ink",
                      )}
                    >
                      <item.icon
                        className={cn("size-4", active ? "text-accent" : "opacity-70")}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-4">
        <Link
          href={`/people/${user.id}`}
          className="flex items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-surface-2/70"
        >
          <Avatar name={user.name} hue={user.hue} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{user.name}</span>
            <span className="block truncate text-[11px] text-ink-faint">
              {user.title ?? ROLE_LABELS[role]}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}

/**
 * Bottom tab bar for mobile: four core tabs plus a Menu tab that opens a
 * full-screen sheet with every section the role can access (and search),
 * so nothing in the app is unreachable on a phone.
 */
export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const sections = sectionsForRole(role);
  const core = sections
    .flatMap((s) => s.items)
    .filter((i) => ["/dashboard", "/tasks", "/reports", "/leave"].includes(i.href))
    .slice(0, 4);

  // Close the sheet whenever navigation happens (state-adjustment-on-change
  // pattern; avoids an extra effect render).
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMenuOpen(false);
  }

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const tab = (active: boolean) =>
    cn(
      "flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
      active ? "text-ink" : "text-ink-faint",
    );
  const pill = (active: boolean) =>
    cn(
      "flex h-6 w-10 items-center justify-center rounded-full",
      active && "bg-ink text-accent",
    );

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-bg lg:hidden">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
            <BrandLogo className="[&_img]:h-5" />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-full border border-line text-ink-soft"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4">
            <form action="/search" className="relative mb-5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="search"
                name="q"
                placeholder="Search people, tasks, projects…"
                className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm outline-none placeholder:text-ink-faint focus:border-line-strong focus:ring-2 focus:ring-accent/50"
              />
            </form>
            {sections.map((section) => (
              <div key={section.label} className="mb-6">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  {section.label}
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  {section.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-[13px] font-medium",
                            active
                              ? "border-transparent bg-ink text-bg"
                              : "border-line bg-surface text-ink-soft",
                          )}
                        >
                          <item.icon
                            className={cn("size-4", active ? "text-accent" : "opacity-70")}
                          />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="flex items-stretch justify-around">
          {core.map((item) => {
            const active = !menuOpen && isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={tab(active)}
                >
                  <span className={pill(active)}>
                    <item.icon className="size-4" />
                  </span>
                  {item.label.replace("My ", "").replace("Daily ", "").replace(" & Requests", "")}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className={tab(menuOpen)}
            >
              <span className={pill(menuOpen)}>
                {menuOpen ? <X className="size-4" /> : <MenuIcon className="size-4" />}
              </span>
              Menu
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
