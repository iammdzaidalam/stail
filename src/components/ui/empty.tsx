import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line-strong px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <div className="mb-1 text-ink-faint">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-ink-faint">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
