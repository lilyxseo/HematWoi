import clsx from "clsx";

const TYPE_COLORS: Record<string, string> = {
  income: "bg-emerald-500/80",
  expense: "bg-rose-500/80",
  transfer: "bg-slate-500/80",
};

interface CategoryDotProps {
  color?: string | null;
  type?: string | null;
  className?: string;
  "aria-hidden"?: boolean;
}

export default function CategoryDot({ color, type, className, ...rest }: CategoryDotProps) {
  const fallback = type ? TYPE_COLORS[type] : "bg-slate-500/70";
  return (
    <span
      className={clsx("inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full", fallback, className)}
      style={color ? { backgroundColor: color } : undefined}
      {...rest}
    />
  );
}
