import { cn } from "@/lib/utils";

/** The four-point star from the stail wordmark, in currentColor. */
export function Spark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-4", className)} aria-hidden>
      <path
        d="M32 4 C35 19 45 29 60 32 C45 35 35 45 32 60 C29 45 19 35 4 32 C19 29 29 19 32 4 Z"
        fill="currentColor"
      />
    </svg>
  );
}
