import clsx from "clsx";
import { NavLink } from "react-router-dom";

export default function SidebarItem({
  icon: Icon,
  label,
  to,
  showLabel = true,
  onNavigate,
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          showLabel ? "justify-start" : "justify-center",
          isActive
            ? "border-l-2 border-[#3898f8] bg-[#3898f8]/10 text-[#3898f8]"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
        )
      }
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {showLabel && <span className="ml-3 truncate">{label}</span>}
    </NavLink>
  );
}
