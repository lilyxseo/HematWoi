import clsx from "clsx";
import type { HTMLAttributes } from "react";

interface CategoryDotProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string | null;
}

export default function CategoryDot({ color, className, style, ...props }: CategoryDotProps) {
  return (
    <span
      aria-hidden="true"
      {...props}
      className={clsx("inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full", className)}
      style={{
        backgroundColor: color || "var(--accent, #38bdf8)",
        ...style,
      }}
    />
  );
}
