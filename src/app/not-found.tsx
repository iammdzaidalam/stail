import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Spark } from "@/components/ui/spark";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <Spark className="size-10 text-accent" />
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-faint">
          404
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          The link may be old, or you may not have access to it.
        </p>
      </div>
      <Link href="/dashboard" className={buttonClass({ variant: "primary" })}>
        Back to dashboard
      </Link>
    </div>
  );
}
