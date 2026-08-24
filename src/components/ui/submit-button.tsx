"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button, type ButtonProps } from "./button";

/**
 * Form submit button with automatic pending state: disables itself and shows
 * a spinner while its parent form's server action is running, preventing
 * double-submits. Use inside <form action={...}> in server components.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ButtonProps & { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || props.disabled}>
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
