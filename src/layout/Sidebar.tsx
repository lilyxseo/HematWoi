import { NavLink } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { cn, roleLabels, useAuthStore, useUIStore } from '../lib/utils';

const navigation = [
  { to: '/', label: 'Dashboard' },
  { to: '/receive', label: 'Receive' },
  { to: '/putaway', label: 'Putaway' },
  { to: '/pick', label: 'Pick' },
  { to: '/cycle-count', label: 'Cycle Count' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/masters/items', label: 'Items Master' },
  { to: '/masters/locations', label: 'Locations Master' }
];

const SidebarLink = ({ to, label, onClick }: { to: string; label: string; onClick: () => void }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-blue-50',
          isActive ? 'bg-blue-100 text-[var(--color-text)]' : 'text-slate-600'
        )
      }
      onClick={onClick}
    >
      {label}
    </NavLink>
  );
};

const Sidebar = () => {
  const role = useAuthStore((state) => state.role);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const closeSidebar = useUIStore((state) => state.closeSidebar);

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation overlay"
        className={cn(
          'fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )}
        onClick={closeSidebar}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col gap-6 border-r border-slate-200 bg-white p-6 shadow-xl transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Warehouse</p>
            <h1 className="text-xl font-semibold text-[var(--color-text)]">WMS Console</h1>
            <p className="text-xs text-slate-500">Role: {roleLabels[role]}</p>
          </div>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={closeSidebar}>
            Close
          </Button>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
          {navigation.map((item) => (
            <SidebarLink key={item.to} to={item.to} label={item.label} onClick={closeSidebar} />
          ))}
        </nav>
        <footer className="text-xs text-slate-400">
          Build {new Date().getFullYear()} • Optimized for scanner workflows
        </footer>
      </aside>
    </>
  );
};

export default Sidebar;
