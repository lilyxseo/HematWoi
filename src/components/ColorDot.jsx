import clsx from "clsx";

export default function ColorDot({ color = "#64748b", className = "" }) {
  return (
    <span
      className={clsx(
        "inline-block h-3 w-3 rounded-full border",
        className
      )}
      style={{ backgroundColor: color }}
    />
  );
}
