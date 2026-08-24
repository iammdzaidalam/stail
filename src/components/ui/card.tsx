import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Standard light-surface card. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-3xl border border-line bg-surface p-6", className)}
      {...props}
    />
  );
}

/** Inverted (dark-on-light / light-on-dark) feature card — the signature mixed panel. */
export function PanelCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-3xl bg-panel p-6 text-panel-ink", className)}
      {...props}
    />
  );
}

/** Tiny uppercase label used above values and section groups. */
export function CardLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint",
        className,
      )}
      {...props}
    />
  );
}
