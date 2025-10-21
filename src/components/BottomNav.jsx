import { NavLink } from "react-router-dom";
import {
  IconHome as Home,
  IconPlus as Plus,
  IconChartBar as BarChart3,
  IconSettings as Settings,
  IconFlag as Flag
} from '@tabler/icons-react';

export default function BottomNav() {
  const base =
    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-muted";
  const active = "text-brand-var";
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface-1 border-t border-border md:hidden pb-safe">
      <div className="flex">
        <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : ""}`}>
          <Home className="h-5 w-5" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/transaction/add" className={({ isActive }) => `${base} ${isActive ? active : ""}`}>
          <Plus className="h-5 w-5" />
          <span>Tambah</span>
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => `${base} ${isActive ? active : ""}`}>
          <BarChart3 className="h-5 w-5" />
          <span>Laporan</span>
        </NavLink>
        <NavLink to="/challenges" className={({ isActive }) => `${base} ${isActive ? active : ""}`}>
          <Flag className="h-5 w-5" />
          <span>Challenges</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `${base} ${isActive ? active : ""}`}>
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  );
}

