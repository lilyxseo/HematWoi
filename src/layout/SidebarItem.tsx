import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

type SidebarItemProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  to: string;
  isMini: boolean;
  onNavigate?: () => void;
};

export function SidebarItem({ icon: Icon, label, to, isMini, onNavigate }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'group/side-item relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3898f8]',
          isMini ? 'justify-center px-2' : 'justify-start',
          isActive
            ? 'border-l-2 border-[#3898f8] bg-[#3898f8]/10 text-[#2584e4] shadow-sm dark:bg-[#3898f8]/20 dark:text-[#8ec9ff]'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-100',
        )
      }
      onClick={onNavigate}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span
        className={clsx(
          'origin-left text-sm font-medium text-slate-600 transition-all duration-200 dark:text-slate-200',
          isMini
            ? 'pointer-events-none absolute translate-x-[-12px] scale-95 opacity-0'
            : 'relative translate-x-0 scale-100 opacity-100',
        )}
        aria-hidden={isMini}
      >
        {label}
      </span>
      {isMini ? <span className="sr-only">{label}</span> : null}
    </NavLink>
  );
}

export default SidebarItem;
