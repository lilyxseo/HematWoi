import clsx from "clsx";
import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

interface SidebarItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  onNavigate?: () => void;
}

export default function SidebarItem({
  to,
  icon,
  label,
  collapsed = false,
  disabled = false,
  badge,
  onNavigate,
}: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        clsx(
          "relative isolate flex h-11 min-w-0 items-center gap-3 rounded-xl px-3 text-sm font-medium tracking-tight text-muted transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
          "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-[var(--accent)] before:opacity-0 before:transition-opacity before:content-['']",
          !collapsed && "justify-start",
          collapsed && "justify-center px-2",
          disabled && "pointer-events-none opacity-40",
          !disabled && "hover:bg-muted/20",
          isActive &&
            "bg-[color:rgb(var(--accent-rgb)/0.12)] text-[var(--accent)] ring-1 ring-[color:rgb(var(--accent-rgb)/0.35)] before:opacity-100"
        )
      }
      onClick={onNavigate}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-inherit">
        {icon}
      </span>
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="truncate text-[15px] text-inherit">{label}</span>
      )}
      {badge ? <span className="ml-auto shrink-0 text-xs text-muted">{badge}</span> : null}
    </NavLink>
  );
}
