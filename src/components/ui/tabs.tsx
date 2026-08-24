import Link from "next/link";
import { cn } from "@/lib/utils";

export type LinkTab = {
  href: string;
  label: string;
  active: boolean;
  count?: number;
};

/** Pill-style segmented control built from links (server-friendly). */
export function LinkTabs({ tabs, className }: { tabs: LinkTab[]; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1",
        className,
      )}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href + tab.label}
          href={tab.href}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
            tab.active
              ? "bg-ink text-bg"
              : "text-ink-soft hover:bg-surface-2/70 hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                tab.active ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-soft",
              )}
            >
              {tab.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
