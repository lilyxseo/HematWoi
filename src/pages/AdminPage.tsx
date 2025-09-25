import { useState } from 'react';
import clsx from 'clsx';
import { Icon } from '../components/icons';
import AdminSidebarTab from './admin/AdminSidebarTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminAuditTab from './admin/AdminAuditTab';

const TABS = [
  { key: 'sidebar', label: 'Sidebar Menu', icon: 'list' },
  { key: 'users', label: 'Users', icon: 'user' },
  { key: 'settings', label: 'App Settings', icon: 'settings' },
  { key: 'audit', label: 'Audit Log', icon: 'shield' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('sidebar');

  return (
    <div className="min-h-screen bg-background/60 pb-16">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin Panel</h1>
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                Admin
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Kelola navigasi aplikasi, pengguna, dan pengaturan inti.</p>
          </div>
          <nav aria-label="Admin sections" className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  'flex h-11 items-center gap-2 rounded-2xl border px-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  activeTab === tab.key
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border/70 bg-background hover:border-primary/50 hover:bg-muted/60'
                )}
              >
                <Icon
                  name={tab.icon}
                  className={clsx('h-5 w-5', activeTab === tab.key ? 'text-primary-foreground' : 'text-muted-foreground')}
                />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-6 lg:px-8">
        {activeTab === 'sidebar' ? (
          <AdminSidebarTab />
        ) : activeTab === 'users' ? (
          <AdminUsersTab />
        ) : activeTab === 'settings' ? (
          <AdminSettingsTab />
        ) : (
          <AdminAuditTab />
        )}
      </main>
    </div>
  );
}
