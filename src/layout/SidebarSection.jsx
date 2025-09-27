import clsx from "clsx";

export default function SidebarSection({ title, children, showLabel = true }) {
  return (
    <div className="space-y-2">
      <p
        className={clsx(
          "px-3 text-xs font-semibold uppercase tracking-wide text-slate-500",
          !showLabel && "hidden"
        )}
      >
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
