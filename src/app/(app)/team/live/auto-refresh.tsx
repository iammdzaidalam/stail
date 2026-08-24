"use client";

// Tiny client island: re-fetches the server-rendered live board every 30s
// and shows when it was last updated (IST wall clock).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IST } from "@/lib/time";

const clockFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    // Stamp the initial render time asynchronously (avoids a sync setState
    // in the effect body and any SSR/client mismatch), then refresh on a timer.
    const initial = setTimeout(() => setUpdatedAt(new Date()), 0);
    const id = setInterval(() => {
      router.refresh();
      setUpdatedAt(new Date());
    }, intervalMs);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [router, intervalMs]);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium tabular-nums text-ink-soft">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-accent" />
      </span>
      {updatedAt ? `Updated ${clockFmt.format(updatedAt)}` : "Live"}
    </span>
  );
}
