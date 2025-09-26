import clsx from "clsx";
import type { CSSProperties } from "react";

type CategoryDotProps = {
  color?: string | null;
  className?: string;
};

export default function CategoryDot({ color, className }: CategoryDotProps) {
  const style: CSSProperties | undefined = color ? { backgroundColor: color } : undefined;

  return (
    <span
      className={clsx("inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-slate-500", className)}
      style={style}
      aria-hidden="true"
    />
  );
}
