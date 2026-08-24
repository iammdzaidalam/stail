"use client";

import { useSyncExternalStore } from "react";
import { fmtDuration } from "@/lib/time";

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 30_000);
  return () => clearInterval(id);
}

/**
 * Live-ticking "worked today" duration. Derives minutes from the clock-in
 * timestamp and accumulated (closed) break minutes, so it stays correct as
 * time passes; while paused (on break) it renders the server-computed value.
 */
export function LiveDuration({
  clockInMs,
  breakMinutes,
  fallbackMinutes,
  running,
}: {
  clockInMs: number;
  breakMinutes: number;
  fallbackMinutes: number;
  running: boolean;
}) {
  const minutes = useSyncExternalStore(
    subscribe,
    () =>
      running
        ? Math.max(0, Math.floor((Date.now() - clockInMs) / 60_000) - breakMinutes)
        : fallbackMinutes,
    () => fallbackMinutes,
  );
  return <>{fmtDuration(minutes)}</>;
}
