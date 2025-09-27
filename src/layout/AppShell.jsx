import { useState } from "react";
import { NavLink, useLocation, useRoutes } from "react-router-dom";
import { Bell, CircleUserRound, Mail, Menu, Search } from "lucide-react";
import { NAV_ITEMS } from "../router/nav.config";
import { buildBreadcrumbs } from "../router/breadcrumbs";
import { ROUTES } from "../router/routes";
import AppSidebar from "./AppSidebar";
import { ModeProvider, useMode } from "../hooks/useMode";

function ShellContent() {
  const element = useRoutes(ROUTES);
  const location = useLocation();
  const breadcrumbs = buildBreadcrumbs(location.pathname, NAV_ITEMS);
  const { mode } = useMode();
  const [theme, setTheme] = useState("dark");
  const [brand, setBrand] = useState({ h: 211, s: 92, l: 60 });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full min-w-0">
      <AppSidebar
        theme={theme}
        setTheme={setTheme}
        brand={brand}
        setBrand={setBrand}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border/40 bg-indigo-500 text-white shadow-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Buka navigasi"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-500 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                aria-label="Cari"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-500"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Pesan masuk"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-500"
              >
                <Mail className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Notifikasi"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-500"
              >
                <Bell className="h-5 w-5" />
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white">
                <CircleUserRound className="h-5 w-5" />
              </div>
            </div>
          </div>
          <nav
            aria-label="Breadcrumb"
            className="px-4 pb-3 text-xs text-white/80 lg:px-6"
          >
            {breadcrumbs.map((b, idx) => (
              <span key={b.path}>
                {idx > 0 && <span className="px-1">/</span>}
                {idx < breadcrumbs.length - 1 ? (
                  <NavLink
                    to={b.path}
                    className="text-white/90 underline-offset-4 hover:text-white"
                  >
                    {b.title}
                  </NavLink>
                ) : (
                  <span className="font-semibold text-white">{b.title}</span>
                )}
              </span>
            ))}
          </nav>
        </header>
        <main className="flex-1 min-w-0 p-4">{element}</main>
        <div className="border-t p-2 text-right text-xs">
          {mode === "online" ? "✅ Online Mode aktif" : "📴 Local Mode aktif"}
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
