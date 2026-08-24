import Link from "next/link";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  good: "border-good/30 bg-good/10 text-ink [&_svg.notice-icon]:text-good",
  warn: "border-warn/30 bg-warn/10 text-ink [&_svg.notice-icon]:text-warn",
  bad: "border-bad/30 bg-bad/10 text-ink [&_svg.notice-icon]:text-bad",
} as const;

/**
 * Inline outcome banner for redirect-based action feedback
 * (`?done=` / `?problem=` patterns). `dismissHref` renders an X that links
 * back to the same page without the notice param.
 */
export function NoticeBanner({
  tone,
  children,
  dismissHref,
  className,
}: {
  tone: keyof typeof tones;
  children: ReactNode;
  dismissHref?: string;
  className?: string;
}) {
  const Icon = tone === "good" ? CheckCircle2 : TriangleAlert;
  return (
    <div
      role="status"
      className={cn(
        "mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
        tones[tone],
        className,
      )}
    >
      <Icon className="notice-icon mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {dismissHref && (
        <Link
          href={dismissHref}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-ink-faint transition hover:bg-surface-2/70 hover:text-ink"
        >
          <X className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
