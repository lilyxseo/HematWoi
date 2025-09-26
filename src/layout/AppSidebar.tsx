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
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "Tutup navigasi" : "Buka navigasi"}
        className={clsx(
          "group fixed right-5 top-5 z-[65] inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/40 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg backdrop-blur transition-all duration-200 lg:hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary focus-visible:ring-offset-background",
          "hover:translate-y-[-1px] hover:shadow-[0_18px_35px_-15px_hsl(var(--color-primary)/0.55)]"
        )}
      >
        <Menu
          className={clsx(
            "h-6 w-6 transition-transform duration-200 group-hover:scale-110",
            mobileOpen && "rotate-90"
          )}
        />
      </button>
    </>
  );
}
