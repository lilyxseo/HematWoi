import clsx from "clsx";

interface CategoryDotProps {
  color?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP: Record<CategoryDotProps["size"], string> = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

export default function CategoryDot({ color, className, size = "md" }: CategoryDotProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx("inline-flex flex-shrink-0 rounded-full bg-slate-600", SIZE_MAP[size], className)}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}
