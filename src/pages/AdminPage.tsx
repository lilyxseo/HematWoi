import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '../components/icons';
import AdminSidebarTab from './admin/AdminSidebarTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminAuditTab from './admin/AdminAuditTab';

type TabKey = 'sidebar' | 'users' | 'settings' | 'audit';

type TabConfig = {
  key: TabKey;
  label: string;
  icon: string;
};

const TABS: TabConfig[] = [
  { key: 'sidebar', label: 'Sidebar Menu', icon: 'list' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'settings', label: 'App Settings', icon: 'settings' },
  { key: 'audit', label: 'Audit Log', icon: 'shield' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('sidebar');

  const activeComponent = useMemo(() => {
    switch (activeTab) {
      case 'sidebar':
        return <AdminSidebarTab />;
      case 'users':
        return <AdminUsersTab />;
      case 'settings':
        return <AdminSettingsTab />;
      case 'audit':
        return <AdminAuditTab />;
      default:
        return null;
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-muted-foreground/70">Home</span>
              <span aria-hidden="true">/</span>
              <span>Admin</span>
            </div>
            <h1 className="text-3xl font-semibold text-foreground">Admin Panel</h1>
          </div>
          <span className="inline-flex h-8 items-center justify-center rounded-full bg-primary/10 px-3 text-sm font-medium text-primary">
            Admin
          </span>
        </div>
        <div className="border-t border-border/40">
          <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    'inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    activeTab === tab.key
                      ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                      : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/40'
                  )}
                  aria-pressed={activeTab === tab.key}
                >
                  <Icon name={tab.icon} className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 md:px-6 lg:px-8">
        <div className="space-y-6" role="tabpanel" aria-label={TABS.find((tab) => tab.key === activeTab)?.label}>
          {activeComponent}
        </div>
      </main>
    </div>
  );
}
