import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Menu } from "lucide-react";
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
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="group fixed z-[65] inline-flex h-11 items-center gap-3 rounded-full border border-border/80 bg-surface-1/95 px-4 text-sm font-medium text-text shadow-lg shadow-black/5 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 lg:hidden"
        aria-label="Buka navigasi"
        aria-expanded={mobileOpen}
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 1rem)",
          left: "calc(env(safe-area-inset-left, 0px) + 1rem)",
        }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand transition-colors group-hover:bg-brand/15">
          <Menu className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
        </div>
        <span className="whitespace-nowrap">Menu</span>
      </button>
    </>
  );
}
