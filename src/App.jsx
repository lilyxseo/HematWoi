import { createElement, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronDown,
  Home,
  ListChecks,
  LogOut,
  Menu,
  PiggyBank,
  Settings,
  Wallet,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    title: "Menu",
    items: [
      { label: "Dashboard", to: "/", icon: Home },
      { label: "Transaksi", to: "/transactions", icon: Wallet },
      { label: "Anggaran", to: "/budgets", icon: PiggyBank },
      { label: "Kategori", to: "/categories", icon: ListChecks },
      { label: "Laporan", to: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Lainnya",
    items: [{ label: "Pengaturan", to: "/settings", icon: Settings }],
  },
];

function App() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMini, setSidebarMini] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileButtonRef = useRef(null);
  const drawerPanelRef = useRef(null);

  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleClick = (event) => {
      if (drawerPanelRef.current?.contains(event.target)) return;
      setSidebarOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [sidebarOpen]);

  const renderSidebarContent = (mini) => (
    <nav className="flex flex-1 flex-col gap-4">
      {NAV_SECTIONS.map((section) => (
        <SidebarSection key={section.title} title={section.title} mini={mini}>
          {section.items.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              mini={mini}
              label={item.label}
              onNavigate={() => setSidebarOpen(false)}
            />
          ))}
        </SidebarSection>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-50 h-14 bg-[#3898f8] text-white shadow-sm">
        <div className="flex h-full items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg p-2 text-white hover:bg-[#2584e4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:hidden"
              aria-label="Buka navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-base font-semibold sm:text-lg">HematWoi</span>
          </div>
          <TopbarRight
            onOpenChange={setProfileOpen}
            profileOpen={profileOpen}
            profileRef={profileButtonRef}
          />
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          onMouseEnter={() => setSidebarMini(false)}
          onMouseLeave={() => setSidebarMini(true)}
          className={`sticky top-14 hidden h-[calc(100vh-56px)] shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm transition-[width] duration-200 dark:border-slate-700 dark:bg-slate-800 sm:flex ${
            sidebarMini ? "w-16" : "w-64"
          }`}
        >
          <div className="flex flex-1 flex-col overflow-y-auto px-2 py-4">
            {renderSidebarContent(sidebarMini)}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors duration-200 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Ringkasan Keuangan
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Kelola keuangan Anda dengan mudah melalui dashboard modern ini.
              Gunakan navigasi di samping untuk berpindah antar fitur utama.
            </p>
          </div>
          <div className="mt-6">
            <Outlet />
          </div>
        </main>
      </div>

      {sidebarOpen ? (
        <div className="sm:hidden">
          <div className="fixed inset-0 z-40 bg-black/40" aria-hidden="true" />
          <div
            ref={drawerPanelRef}
            className="fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-slate-200 bg-white p-4 shadow-xl transition-transform duration-200 dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="self-end rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3898f8] dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label="Tutup navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="mt-4 flex flex-1 flex-col gap-4">
              {renderSidebarContent(false)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TopbarRight({ onOpenChange, profileOpen, profileRef }) {
  const toggleProfile = () => onOpenChange((previous) => !previous);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        type="button"
        aria-label="Lihat notifikasi"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg p-2 text-white transition-colors duration-150 hover:bg-[#2584e4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Bell className="h-5 w-5" />
        <span className="absolute right-2 top-2 inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-rose-300" />
      </button>
      <div className="relative">
        <button
          type="button"
          ref={profileRef}
          onClick={toggleProfile}
          className="flex items-center gap-2 rounded-full pl-2 pr-1 py-1 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          aria-label="Buka menu profil"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-semibold uppercase text-white">
            AN
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>
        <ProfileDropdown
          anchorRef={profileRef}
          open={profileOpen}
          onClose={() => onOpenChange(false)}
        />
      </div>
    </div>
  );
}

function SidebarSection({ title, children, mini }) {
  return (
    <div>
      <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {mini ? title.slice(0, 1) : title}
      </div>
      <div className="mt-1 flex flex-col gap-1">{children}</div>
    </div>
  );
}

function SidebarItem({ icon, label, to, mini, onNavigate }) {
  const iconNode = createElement(icon, { className: "h-5 w-5" });

  return (
    <NavLink
      to={to}
      className={({ isActive }) => {
        const activeClass = isActive
          ? "border-l-2 border-[#3898f8] bg-[#3898f8]/10 text-[#3898f8]"
          : "text-slate-600 dark:text-slate-300";
        const justifyClass = mini ? "justify-center" : "pl-3";

        return `group relative flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors duration-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3898f8] dark:hover:bg-slate-700 ${activeClass} ${justifyClass}`;
      }}
      onClick={onNavigate}
    >
      <span className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors duration-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        {iconNode}
      </span>
      <span
        className={`whitespace-nowrap text-sm font-medium transition-all duration-200 ${
          mini ? "w-0 opacity-0" : "w-auto opacity-100"
        }`}
      >
        {label}
      </span>
    </NavLink>
  );
}

function ProfileDropdown({ anchorRef, open, onClose }) {
  const dropdownRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (
        dropdownRef.current?.contains(event.target) ||
        anchorRef?.current?.contains(event.target)
      ) {
        return;
      }
      onClose?.();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={dropdownRef}
      role="menu"
      className={`absolute right-0 mt-2 w-48 origin-top-right rounded-xl bg-white py-2 text-sm text-slate-700 shadow-lg ring-1 ring-black/5 transition duration-150 ease-out focus:outline-none dark:bg-slate-800 dark:text-slate-100 ${
        visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
      style={{ transformOrigin: "top right" }}
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center justify-between px-4 py-2 text-left transition duration-150 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3898f8] dark:hover:bg-slate-700"
      >
        Profil
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center justify-between px-4 py-2 text-left transition duration-150 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3898f8] dark:hover:bg-slate-700"
      >
        Pengaturan
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center justify-between px-4 py-2 text-left text-rose-500 transition duration-150 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:hover:bg-rose-500/10"
      >
        Keluar
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export default App;
