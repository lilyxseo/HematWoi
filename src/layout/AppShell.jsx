import { useEffect, useMemo, useRef, useState } from "react";
import { useRoutes } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Home,
  ListChecks,
  Menu,
  PiggyBank,
  Settings,
  Wallet,
} from "lucide-react";
import { ROUTES } from "../router/routes";
import { ModeProvider } from "../hooks/useMode";
import SidebarSection from "./SidebarSection";
import SidebarItem from "./SidebarItem";

const NAVIGATION_SECTIONS = [
  {
    id: "utama",
    label: "Utama",
    items: [
      { id: "dashboard", label: "Dashboard", icon: Home, to: "/" },
      {
        id: "transactions",
        label: "Transaksi",
        icon: Wallet,
        to: "/transactions",
      },
      { id: "budgets", label: "Anggaran", icon: PiggyBank, to: "/budgets" },
      { id: "categories", label: "Kategori", icon: ListChecks, to: "/categories" },
      { id: "reports", label: "Laporan", icon: BarChart3, to: "/data" },
    ],
  },
  {
    id: "others",
    label: "Lainnya",
    items: [
      {
        id: "settings",
        label: "Pengaturan",
        icon: Settings,
        to: "/settings",
      },
    ],
  },
];

function ShellContent() {
  const element = useRoutes(ROUTES);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarMini, setIsSidebarMini] = useState(true);
  const [isSidebarHovering, setIsSidebarHovering] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const navigationSections = useMemo(() => NAVIGATION_SECTIONS, []);
  const shouldShowLabels = !isSidebarMini || isSidebarHovering;

  useEffect(() => {
    const handleOutside = (event) => {
      if (!isProfileMenuOpen) return;
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        setIsMobileSidebarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isProfileMenuOpen]);

  const handleNavigate = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="relative flex min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <aside
        className={`group hidden border-r border-slate-200 bg-white shadow-sm transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-col ${
          isSidebarMini && !shouldShowLabels ? "lg:w-16" : "lg:w-64"
        }`}
        onMouseEnter={() => setIsSidebarHovering(true)}
        onMouseLeave={() => setIsSidebarHovering(false)}
      >
        <div className="flex h-14 items-center gap-2 px-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3898f8]/10 text-lg font-semibold text-[#3898f8]">
            HW
          </span>
          {shouldShowLabels && (
            <div className="flex flex-1 items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-100">
                HematWoi
              </span>
              <button
                type="button"
                onClick={() => setIsSidebarMini((prev) => !prev)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                aria-label={isSidebarMini ? "Kunci sidebar" : "Mini sidebar"}
              >
                {isSidebarMini ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-6 px-2 py-4">
          {navigationSections.map((section) => (
            <SidebarSection
              key={section.id}
              title={section.label}
              showLabel={shouldShowLabels}
            >
              {section.items.map((item) => (
                <SidebarItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  to={item.to}
                  showLabel={shouldShowLabels}
                  onNavigate={handleNavigate}
                />
              ))}
            </SidebarSection>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-4 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          © {new Date().getFullYear()} HematWoi
        </div>
      </aside>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-72 max-w-[80%] flex-col bg-white shadow-xl transition-transform dark:bg-slate-900">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Navigasi
              </span>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => setIsMobileSidebarOpen(false)}
                aria-label="Tutup navigasi"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
              {navigationSections.map((section) => (
                <SidebarSection key={section.id} title={section.label} showLabel>
                  {section.items.map((item) => (
                    <SidebarItem
                      key={item.id}
                      icon={item.icon}
                      label={item.label}
                      to={item.to}
                      showLabel
                      onNavigate={handleNavigate}
                    />
                  ))}
                </SidebarSection>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col lg:ml-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/20 bg-gradient-to-r from-[#3898f8] to-[#2584e4] px-4 text-white shadow-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60 lg:hidden"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Buka sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium tracking-wide">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"
              aria-label="Notifikasi"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-[10px] top-[10px] inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400" />
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-sm font-medium transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-sm font-semibold text-[#2584e4]">
                  HW
                </span>
                <span className="hidden text-xs font-medium sm:inline">Akun Saya</span>
              </button>
              {isProfileMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-48 origin-top-right rounded-xl bg-white/95 p-2 text-slate-700 shadow-xl ring-1 ring-black/5 backdrop-blur dark:bg-slate-800/95 dark:text-slate-100"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  >
                    Profil
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  >
                    Pengaturan
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-rose-500 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  >
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 pb-10 pt-6 dark:bg-slate-950">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {element}
            </div>
          </div>
        </main>
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
