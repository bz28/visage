import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  // The dark CTA — now lifts + deepens its shadow on hover (was inert).
  primary:
    "bg-foreground text-background shadow-card hover:-translate-y-px hover:bg-[#262220] hover:shadow-pop",
  // Secondary / cancel — warm border that firms up on hover.
  ghost:
    "border border-ink-300 text-foreground hover:border-ink-400 hover:bg-ink-100/70",
};

/**
 * The one primary/ghost button: a rounded pill with consistent hover-lift and
 * press feedback (previously every CTA hand-rolled this and most had no hover).
 * Size and width come from the caller via `className` (px/py/w-full).
 */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
