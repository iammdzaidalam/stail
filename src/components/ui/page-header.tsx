import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight md:text-[32px]">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** Section heading inside a page, with optional trailing action/link. */
export function SectionTitle({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}
