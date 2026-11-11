import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  senda: "rounded-full bg-forest text-cream hover:bg-forest-soft",
  cream: "rounded-full bg-cream text-forest hover:bg-cream-deep",
  ghostForest:
    "rounded-full border border-cream/40 bg-transparent text-cream hover:bg-cream/10",
  ghost: "rounded-full bg-transparent text-forest hover:bg-cream-deep",
} as const;

const sizes = {
  cta: "min-h-12 gap-2 px-7 text-base font-medium tracking-[-0.01em]",
  md: "min-h-11 gap-2 px-5 text-[0.95rem] font-medium",
  icon: "size-10",
} as const;

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  /** Use inside a link. A button nested in an anchor is invalid HTML. */
  as?: "button" | "span";
};

export function Button({
  className,
  variant = "senda",
  size = "cta",
  as = "button",
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex shrink-0 items-center justify-center transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-forest/30 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
  if (as === "span") {
    return <span className={classes}>{props.children}</span>;
  }
  return <button className={classes} {...props} />;
}
