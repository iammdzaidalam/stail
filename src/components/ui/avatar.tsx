import { cn, initials } from "@/lib/utils";

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
  xl: "size-16 text-lg",
} as const;

export function Avatar({
  name,
  hue = 200,
  size = "md",
  className,
}: {
  name: string;
  hue?: number;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: `hsl(${hue} 40% 42%)` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping avatar row, like the inspiration's people clusters. */
export function AvatarStack({
  people,
  max = 5,
  size = "sm",
}: {
  people: { name: string; hue?: number }[];
  max?: number;
  size?: keyof typeof sizes;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          hue={p.hue}
          size={size}
          className={cn("ring-2 ring-surface", i > 0 && "-ml-2")}
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "-ml-2 inline-flex items-center justify-center rounded-full bg-surface-2 font-medium text-ink-soft ring-2 ring-surface",
            sizes[size],
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
