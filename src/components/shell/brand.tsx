import Image from "next/image";
import { cn } from "@/lib/utils";

/** The stail wordmark — swaps automatically between light/dark variants. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/brand/stail-light.png"
        alt="stail"
        width={132}
        height={58}
        priority
        className="h-6 w-auto dark:hidden"
      />
      <Image
        src="/brand/stail-dark.png"
        alt="stail"
        width={132}
        height={58}
        priority
        className="hidden h-6 w-auto dark:block"
      />
    </span>
  );
}

/** Forced-dark variant for permanently dark surfaces (login page). */
export function BrandLogoDark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/stail-dark.png"
      alt="stail"
      width={132}
      height={58}
      priority
      className={cn("h-6 w-auto", className)}
    />
  );
}
