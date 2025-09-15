import { NavLink } from "react-router-dom";
import { Home, Plus, BarChart3, Settings } from "lucide-react";

export default function BottomNav() {
  const base =
    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-slate-600 dark:text-slate-300";
  const active = "text-brand";
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t md:hidden pb-safe">
      <div className="flex">
        <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : ""}`}>
          <Home className="h-5 w-5" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/add" className={({ isActive }) => `${base} ${isActive ? active : ""}`}>
          <Plus className="h-5 w-5" />
          <span>Tambah</span>
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => `${base} ${isActive ? active : ""}`}>
          <BarChart3 className="h-5 w-5" />
          <span>Laporan</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `${base} ${isActive ? active : ""}`}>
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  );
}

