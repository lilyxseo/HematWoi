import { createElement } from "react";
import clsx from "clsx";
import { NavLink } from "react-router-dom";

export default function SidebarItem({
  icon,
  label,
  to,
  onNavigate,
  isExpanded,
}) {
  const iconNode = createElement(icon, { className: "h-5 w-5" });
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          "group flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white",
          isActive &&
            "bg-[#3898f8]/10 text-[#3898f8] ring-1 ring-inset ring-[#3898f8]/60 dark:bg-[#3898f8]/20 dark:text-[#3898f8]",
          !isExpanded && "justify-center"
        )
      }
    >
      {iconNode}
      <span
        className={clsx(
          "whitespace-nowrap text-sm font-medium text-slate-700 transition-all duration-200 dark:text-slate-100",
          isExpanded
            ? "ml-3 opacity-100"
            : "pointer-events-none ml-0 w-0 overflow-hidden opacity-0"
        )}
      >
        {label}
      </span>
    </NavLink>
  );
}
