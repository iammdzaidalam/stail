"use client";

import { useSyncExternalStore } from "react";
import { IST } from "@/lib/time";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: IST,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

/** Ticking IST clock for the topbar (empty until hydrated). */
export function LiveClock() {
  const time = useSyncExternalStore(
    subscribe,
    () => fmt.format(new Date()),
    () => "",
  );

  return (
    <span className="hidden font-mono text-xs tabular-nums text-ink-faint md:inline">
      {time ? `${time} IST` : ""}
    </span>
  );
}
