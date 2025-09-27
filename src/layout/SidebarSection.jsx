import clsx from "clsx";

export default function SidebarSection({ label, children, isExpanded }) {
  return (
    <div className="space-y-2">
      <div
        className={clsx(
          "px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-all duration-200 dark:text-slate-400",
          isExpanded
            ? "opacity-100"
            : "pointer-events-none h-0 overflow-hidden px-0 opacity-0"
        )}
      >
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
