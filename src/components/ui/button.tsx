import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-ink text-bg hover:opacity-85",
  accent: "bg-accent text-accent-ink hover:brightness-95",
  outline: "border border-line-strong text-ink hover:bg-surface-2/60",
  ghost: "text-ink-soft hover:bg-surface-2/70 hover:text-ink",
  danger: "bg-bad text-white hover:opacity-90",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-sm",
  icon: "size-10",
};

export function buttonClass(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  const { variant = "primary", size = "md", className } = opts ?? {};
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium tracking-tight transition outline-accent outline-offset-2 focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}
