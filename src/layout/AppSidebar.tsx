import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Sidebar from "../components/sidebar/Sidebar";
import MobileDrawer from "../components/sidebar/MobileDrawer";

type ThemeMode = "light" | "dark" | "system";

type BrandConfig = {
  h: number;
  s: number;
  l: number;
};

interface AppSidebarProps {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  brand: BrandConfig;
  setBrand: (brand: BrandConfig) => void;
}

const STORAGE_KEY = "hw:sidebar-collapsed";

export default function AppSidebar({
  theme,
  setTheme,
  brand,
  setBrand,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
    const root = document.documentElement;
    root.dataset.sidebarCollapsed = collapsed ? "1" : "0";
    root.style.setProperty("--sidebar-width", collapsed ? "4rem" : "16rem");
  }, [collapsed]);

  const sidebarProps = useMemo(
    () => ({ theme, setTheme, brand, setBrand }),
    [theme, setTheme, brand, setBrand]
  );

  return (
    <>
      <aside
        className={clsx(
          "hidden lg:fixed lg:inset-y-0 lg:z-[70] lg:flex lg:h-[100dvh] lg:min-w-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-border lg:bg-surface-1/95 lg:text-text lg:shadow-sm lg:backdrop-blur lg:transition-[width,background-color,color] lg:duration-200",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={setCollapsed}
          {...sidebarProps}
        />
      </aside>
      <MobileDrawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <Sidebar
          collapsed={false}
          onToggle={setCollapsed}
          onNavigate={() => setMobileOpen(false)}
          onClose={() => setMobileOpen(false)}
          {...sidebarProps}
        />
      </MobileDrawer>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[65] flex justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="group pointer-events-auto inline-flex items-center gap-3 rounded-full bg-surface-1/95 px-4 py-2 text-sm font-medium text-text shadow-lg ring-1 ring-border/80 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:ring-ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          aria-label="Buka navigasi"
          aria-expanded={mobileOpen}
        >
          <span className="relative flex h-10 w-10 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 via-primary/10 to-surface-1 shadow-inner ring-1 ring-border/70 transition-all duration-200 group-hover:ring-primary/50 group-active:scale-95" />
            <span className="relative flex flex-col items-center justify-center gap-1.5">
              <span className="h-0.5 w-6 rounded-full bg-text transition-all duration-200 group-hover:w-7" />
              <span className="h-0.5 w-4 rounded-full bg-text/70 transition-all duration-200 group-hover:w-6" />
              <span className="h-0.5 w-5 rounded-full bg-text/50 transition-all duration-200 group-hover:w-7" />
            </span>
          </span>
          <span className="leading-none">Menu</span>
        </button>
      </div>
    </>
  );
}
