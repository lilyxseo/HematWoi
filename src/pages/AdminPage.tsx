import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '../components/icons';
import AdminSidebarTab from './admin/AdminSidebarTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminAuditTab from './admin/AdminAuditTab';
import { getAdminDashboardContent, type AdminDashboardContentSetting } from '../lib/adminApi';
import { useToast } from '../context/ToastContext.jsx';

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

const DASHBOARD_CONTENT_DEFAULT = {
  breadcrumb: 'Dashboard / Admin',
  title: 'Admin Panel',
  subtitle: '',
  badge: 'Admin',
  description: 'Kelola menu, pengguna, dan pengaturan aplikasi di satu tempat.',
};

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
  const { addToast } = useToast();
  const [dashboardContent, setDashboardContent] = useState(() => ({ ...DASHBOARD_CONTENT_DEFAULT }));
  const [loadingContent, setLoadingContent] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingContent(true);
      try {
        const result: AdminDashboardContentSetting = await getAdminDashboardContent();
        if (!active) return;
        setDashboardContent({
          breadcrumb: result.breadcrumb,
          title: result.title,
          subtitle: result.subtitle,
          badge: result.badge,
          description: result.description,
        });
      } catch (error) {
        if (!active) return;
        console.error('[AdminPage] load dashboard content failed', error);
        const message = error instanceof Error ? error.message : 'Gagal memuat konten dashboard admin';
        addToast(message, 'error');
        setDashboardContent({ ...DASHBOARD_CONTENT_DEFAULT });
      } finally {
        if (active) {
          setLoadingContent(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [addToast]);

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
            {loadingContent ? (
              <div className="space-y-3">
                <div className="h-3 w-32 animate-pulse rounded-full bg-muted/40" />
                <div className="flex items-center gap-3">
                  <div className="h-8 w-44 animate-pulse rounded-full bg-muted/40" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-muted/30" />
                </div>
                <div className="h-4 w-72 animate-pulse rounded-full bg-muted/30" />
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-muted-foreground">
                  {dashboardContent.breadcrumb?.trim() || DASHBOARD_CONTENT_DEFAULT.breadcrumb}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {dashboardContent.title?.trim() || DASHBOARD_CONTENT_DEFAULT.title}
                  </h1>
                  {dashboardContent.badge?.trim() ? (
                    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {dashboardContent.badge.trim()}
                    </span>
                  ) : null}
                </div>
                {dashboardContent.subtitle?.trim() ? (
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    {dashboardContent.subtitle.trim()}
                  </p>
                ) : null}
                {dashboardContent.description?.trim() ? (
                  <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                    {dashboardContent.description.trim()}
                  </p>
                ) : null}
              </>
            )}
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
