import { useState } from 'react';
import { Icon } from '../components/icons';
import AdminSidebarTab from './admin/AdminSidebarTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminAuditTab from './admin/AdminAuditTab';

type TabKey = 'sidebar' | 'users' | 'settings' | 'audit';

type TabItem = {
  key: TabKey;
  label: string;
  icon: string;
  description: string;
};

const TABS: TabItem[] = [
  {
    key: 'sidebar',
    label: 'Sidebar Menu',
    icon: 'list',
    description: 'Kelola struktur navigasi aplikasi.',
  },
  {
    key: 'users',
    label: 'Users',
    icon: 'user',
    description: 'Kelola role dan status pengguna.',
  },
  {
    key: 'settings',
    label: 'App Settings',
    icon: 'settings',
    description: 'Perbarui deskripsi dan branding aplikasi.',
  },
  {
    key: 'audit',
    label: 'Audit Log',
    icon: 'shield',
    description: 'Lihat aktivitas terakhir.',
  },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('sidebar');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dashboard / Admin</p>
            <h1 className="text-3xl font-semibold text-foreground">Admin Panel</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {TABS.find((tab) => tab.key === activeTab)?.description}
            </p>
          </div>
          <span className="inline-flex h-9 items-center gap-2 self-start rounded-full border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary md:self-auto">
            <Icon name="shield" className="h-4 w-4" />
            Admin
          </span>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-4 md:px-6 lg:px-8">
          <div className="inline-flex w-full flex-wrap gap-2 rounded-2xl border border-border/40 bg-muted/30 p-1 sm:w-auto" role="tablist">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background/70'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon name={tab.icon} className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
        {activeTab === 'sidebar' && <AdminSidebarTab />}
        {activeTab === 'users' && <AdminUsersTab />}
        {activeTab === 'settings' && <AdminSettingsTab />}
        {activeTab === 'audit' && <AdminAuditTab />}
      </main>
    </div>
  );
}
