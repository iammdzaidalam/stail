import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
}) {
  const width = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className={cn("h-full rounded-full bg-accent transition-all", barClassName)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/**
 * Stacked segment bar for distributions (project allocation, status mix).
 * Segment classNames control color, e.g. "bg-accent", "bg-ink/70".
 */
export function SegmentBar({
  segments,
  className,
}: {
  segments: { value: number; className: string; title?: string }[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-full", className)}>
      {total <= 0 ? (
        <div className="h-full w-full rounded-full bg-surface-2" />
      ) : (
        segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <div
              key={i}
              title={s.title}
              className={cn("h-full rounded-full", s.className)}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ))
      )}
    </div>
  );
}
