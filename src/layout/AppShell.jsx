import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useRoutes } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Home,
  ListChecks,
  Menu,
  PiggyBank,
  Settings,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { NAV_ITEMS } from "../router/nav.config";
import { buildBreadcrumbs } from "../router/breadcrumbs";
import { ROUTES } from "../router/routes";
import SidebarItem from "./SidebarItem";
import SidebarSection from "./SidebarSection";
import { ModeProvider, useMode } from "../hooks/useMode";

const NAV_SECTIONS = [
  {
    label: "Utama",
    items: [
      { label: "Dashboard", href: "/", icon: Home },
      { label: "Transaksi", href: "/transactions", icon: Wallet },
      { label: "Anggaran", href: "/budgets", icon: PiggyBank },
      { label: "Kategori", href: "/categories", icon: ListChecks },
      { label: "Laporan", href: "/data", icon: BarChart3 },
    ],
  },
  {
    label: "Lainnya",
    items: [{ label: "Pengaturan", href: "/settings", icon: Settings }],
  },
];

function ShellContent() {
  const element = useRoutes(ROUTES);
  const location = useLocation();
  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(location.pathname, NAV_ITEMS),
    [location.pathname]
  );
  const { mode } = useMode();
  const pageTitle = breadcrumbs.length
    ? breadcrumbs[breadcrumbs.length - 1].title
    : "Dashboard";

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const profileMenuRef = useRef(null);
  const isSidebarExpanded = isSidebarHovered;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
        setProfileOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!profileOpen) return;
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target) &&
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  const sidebarContent = (
    <nav className="flex flex-1 flex-col gap-8 px-3 py-6">
      {NAV_SECTIONS.map((section) => (
        <SidebarSection
          key={section.label}
          label={section.label}
          isExpanded={isSidebarExpanded}
        >
          {section.items.map((item) => (
            <SidebarItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              to={item.href}
              onNavigate={() => setMobileSidebarOpen(false)}
              isExpanded={isSidebarExpanded}
            />
          ))}
        </SidebarSection>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <aside
        className={clsx(
          "relative hidden border-r border-slate-200 bg-white shadow-sm transition-[width] duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col",
          isSidebarExpanded ? "lg:w-64" : "lg:w-16"
        )}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <div className="flex h-14 items-center justify-center border-b border-slate-200 px-4 dark:border-slate-800">
          <div
            className={clsx(
              "overflow-hidden text-sm font-semibold uppercase tracking-[0.2em] text-[#3898f8] transition-all duration-200",
              isSidebarExpanded ? "opacity-100" : "opacity-0"
            )}
          >
            HematWoi
          </div>
        </div>
        {sidebarContent}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-40 h-14 bg-gradient-to-r from-[#3898f8] to-[#2584e4] shadow-sm">
          <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#3898f8] lg:hidden"
                aria-label="Buka menu navigasi"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-base font-semibold text-white">
                {pageTitle}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#3898f8]"
                aria-label="Buka notifikasi"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 inline-flex h-2 w-2 animate-ping rounded-full bg-rose-400" />
                <span className="absolute right-2 top-2 inline-flex h-2 w-2 rounded-full bg-rose-500" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  ref={profileRef}
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/20 text-sm font-semibold text-white shadow hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#3898f8]"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  aria-label="Buka menu profil"
                >
                  HW
                </button>
                <div
                  ref={profileMenuRef}
                  role="menu"
                  className={clsx(
                    "absolute right-0 mt-3 w-48 origin-top-right rounded-2xl border border-slate-200/80 bg-white p-2 text-sm text-slate-700 shadow-lg ring-1 ring-black/5 transition duration-150 ease-out dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
                    profileOpen
                      ? "pointer-events-auto scale-100 opacity-100"
                      : "pointer-events-none scale-95 opacity-0"
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center rounded-xl px-3 py-2 text-left transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800/80"
                  >
                    Profil
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center rounded-xl px-3 py-2 text-left transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800/80"
                  >
                    Pengaturan
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center rounded-xl px-3 py-2 text-left text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    Keluar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-slate-100/60 py-6 transition-colors duration-200 dark:bg-slate-950">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition dark:border-slate-800 dark:bg-slate-900">
              <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
                {breadcrumbs.map((breadcrumb, index) => (
                  <span key={breadcrumb.path}>
                    {index > 0 && <span className="mx-1 text-slate-400">/</span>}
                    {index < breadcrumbs.length - 1 ? (
                      <NavLink
                        to={breadcrumb.path}
                        className="hover:text-slate-700"
                      >
                        {breadcrumb.title}
                      </NavLink>
                    ) : (
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {breadcrumb.title}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
              <div className="mt-4 text-slate-800 dark:text-slate-100">{element}</div>
            </div>
            <div className="flex justify-end text-xs text-slate-500 dark:text-slate-400">
              {mode === "online" ? "✅ Online Mode aktif" : "📴 Local Mode aktif"}
            </div>
          </div>
        </main>
      </div>

      <div
        className={clsx(
          "fixed inset-0 z-40 flex lg:hidden",
          mobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileSidebarOpen}
      >
        <div
          className={clsx(
            "absolute inset-0 bg-slate-900/60 transition-opacity",
            mobileSidebarOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileSidebarOpen(false)}
        />
        <div
          className={clsx(
            "relative h-full w-72 translate-x-0 transform bg-white shadow-xl transition-transform duration-200 ease-out dark:bg-slate-900",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">
              Navigasi
            </span>
            <button
              type="button"
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Tutup navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <div className="flex h-[calc(100%-3.5rem)] flex-col overflow-y-auto px-2 pb-6">
            {NAV_SECTIONS.map((section) => (
              <SidebarSection key={section.label} label={section.label} isExpanded>
                {section.items.map((item) => (
                  <SidebarItem
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    to={item.href}
                    onNavigate={() => setMobileSidebarOpen(false)}
                    isExpanded
                  />
                ))}
              </SidebarSection>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppShell() {
  return (
    <ModeProvider>
      <ShellContent />
    </ModeProvider>
  );
}
