import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, PanelCard } from "./card";

/**
 * Big-number stat tile. tone="panel" renders the inverted dark card,
 * tone="accent" the lime card — use at most one accent tile per row.
 */
export function StatCard({
  label,
  value,
  sub,
  tone = "surface",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "surface" | "panel" | "accent";
  icon?: ReactNode;
  className?: string;
}) {
  const inner = (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.14em]",
            tone === "surface" ? "text-ink-faint" : "opacity-60",
          )}
        >
          {label}
        </p>
        {icon && <span className="opacity-50">{icon}</span>}
      </div>
      <div>
        <p className="text-3xl font-semibold tracking-tighter tabular-nums md:text-4xl">
          {value}
        </p>
        {sub && (
          <p
            className={cn(
              "mt-1.5 text-xs",
              tone === "surface" ? "text-ink-soft" : "opacity-60",
            )}
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );

  if (tone === "panel") return <PanelCard className={cn("p-5", className)}>{inner}</PanelCard>;
  if (tone === "accent")
    return (
      <div className={cn("rounded-3xl bg-accent p-5 text-accent-ink", className)}>
        {inner}
      </div>
    );
  return <Card className={cn("p-5", className)}>{inner}</Card>;
}
