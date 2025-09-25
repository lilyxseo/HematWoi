import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '../components/icons';
import AdminSidebarTab from './admin/AdminSidebarTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminAuditTab from './admin/AdminAuditTab';

export type AdminTabKey = 'sidebar' | 'users' | 'settings' | 'audit';

type TabDefinition = {
  key: AdminTabKey;
  label: string;
  icon: string;
};

const TABS: TabDefinition[] = [
  { key: 'sidebar', label: 'Sidebar Menu', icon: 'list' },
  { key: 'users', label: 'Users', icon: 'user' },
  { key: 'settings', label: 'App Settings', icon: 'settings' },
  { key: 'audit', label: 'Audit Log', icon: 'shield' },
];

function TabButton({
  tab,
  active,
  onSelect,
}: {
  tab: TabDefinition;
  active: boolean;
  onSelect: (key: AdminTabKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tab.key)}
      className={clsx(
        'flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-medium transition',
        active
          ? 'bg-primary text-white shadow-sm hover:bg-primary/90'
          : 'border border-border/60 bg-background hover:border-border hover:bg-muted/40'
      )}
      aria-pressed={active}
    >
      <Icon name={tab.icon} className="h-4 w-4" />
      <span>{tab.label}</span>
    </button>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTabKey>('sidebar');

  const ActiveSection = useMemo(() => {
    switch (activeTab) {
      case 'users':
        return <AdminUsersTab />;
      case 'settings':
        return <AdminSettingsTab />;
      case 'audit':
        return <AdminAuditTab />;
      case 'sidebar':
      default:
        return <AdminSidebarTab />;
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 md:px-6 lg:px-8">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Dashboard / Admin</p>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Admin
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 md:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap gap-3">
          {TABS.map((tab) => (
            <TabButton key={tab.key} tab={tab} active={tab.key === activeTab} onSelect={setActiveTab} />
          ))}
        </nav>

        <section className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8">{ActiveSection}</div>
        </section>
      </main>
    </div>
  );
}
