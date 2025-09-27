import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Home,
  ListChecks,
  Menu,
  PiggyBank,
  Settings,
  Wallet,
} from 'lucide-react';

import { SidebarItem } from './SidebarItem';
import { SidebarSection } from './SidebarSection';

export type AppShellProps = {
  children: ReactNode;
};

type MenuItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type MenuSection = {
  heading: string;
  items: MenuItem[];
};

const MENU_SECTIONS: MenuSection[] = [
  {
    heading: 'Utama',
    items: [
      { label: 'Dashboard', href: '/', icon: Home },
      { label: 'Transaksi', href: '/transactions', icon: ListChecks },
      { label: 'Anggaran', href: '/budgets', icon: Wallet },
      { label: 'Kategori', href: '/categories', icon: PiggyBank },
      { label: 'Laporan', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    heading: 'Lainnya',
    items: [{ label: 'Pengaturan', href: '/settings', icon: Settings }],
  },
];

export function AppShell({ children }: AppShellProps) {
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarMini, setSidebarMini] = useState(true);
  const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isProfileMenuOpen) return;
      if (
        profileMenuRef.current &&
        event.target instanceof Node &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileSidebarOpen(false);
      setProfileMenuOpen(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const sidebarSections = useMemo(
    () =>
      MENU_SECTIONS.map((section) => (
        <SidebarSection
          key={section.heading}
          heading={section.heading}
          isMini={isSidebarMini}
        >
          {section.items.map((item) => (
            <SidebarItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              to={item.href}
              isMini={isSidebarMini}
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          ))}
        </SidebarSection>
      )),
    [isSidebarMini],
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/20 bg-gradient-to-r from-[#3898f8] to-[#2584e4] px-4 text-white shadow">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:hidden"
            aria-label="Buka navigasi"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <NavLink to="/" className="text-sm font-semibold tracking-tight">
            HematWoi
          </NavLink>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Buka notifikasi"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-400">
              <span className="absolute inset-0 rounded-full bg-rose-400 opacity-75 animate-ping" />
            </span>
          </button>

          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/20 text-sm font-medium uppercase backdrop-blur transition-colors duration-150 hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-haspopup="true"
              aria-expanded={isProfileMenuOpen}
              aria-label="Buka menu profil"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
            >
              <span className="h-full w-full bg-gradient-to-br from-white/80 to-white/40" />
            </button>

            {isProfileMenuOpen ? (
              <div
                role="menu"
                className="animate-scale-fade-in absolute right-0 mt-2 w-48 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white/95 py-2 text-sm text-slate-700 shadow-lg ring-1 ring-black/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors duration-150 hover:bg-slate-100 focus:outline-none focus-visible:bg-slate-100 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Profil
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors duration-150 hover:bg-slate-100 focus:outline-none focus-visible:bg-slate-100 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Pengaturan
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-rose-500 transition-colors duration-150 hover:bg-rose-50 focus:outline-none focus-visible:bg-rose-50 dark:hover:bg-rose-500/20 dark:focus-visible:bg-rose-500/20"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Keluar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="group hidden shrink-0 border-r border-slate-200 bg-white shadow-sm transition-[width] duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 lg:flex"
          onMouseEnter={() => setSidebarMini(false)}
          onMouseLeave={() => setSidebarMini(true)}
          style={{ width: isSidebarMini ? 64 : 256 }}
        >
          <div className="flex h-full w-full flex-col">
            <div className="flex h-14 items-center justify-center border-b border-slate-200 px-2 dark:border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                Menu
              </span>
            </div>
            <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-6">
              {sidebarSections}
            </nav>
          </div>
        </aside>

        {isMobileSidebarOpen ? (
          <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative h-full w-72 max-w-full translate-x-0 bg-white shadow-xl transition-transform duration-200 ease-out dark:bg-slate-900">
              <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                  Navigasi
                </span>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors duration-150 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3898f8] dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="Tutup navigasi"
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
                {MENU_SECTIONS.map((section) => (
                  <SidebarSection key={section.heading} heading={section.heading} isMini={false}>
                    {section.items.map((item) => (
                      <SidebarItem
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                        to={item.href}
                        isMini={false}
                        onNavigate={() => setMobileSidebarOpen(false)}
                      />
                    ))}
                  </SidebarSection>
                ))}
              </nav>
            </div>
          </div>
        ) : null}

        <main className="flex flex-1 flex-col px-4 py-4 transition-colors duration-200 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
