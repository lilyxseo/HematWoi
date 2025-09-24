import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  Sun,
  X,
} from "lucide-react";
import SidebarSection from "./SidebarSection";
import SidebarItem from "./SidebarItem";
import Logo from "../Logo";
import { supabase } from "../../lib/supabase";
import { useMode } from "../../hooks/useMode";
import type { User } from "@supabase/supabase-js";
import { listSidebarItems } from "../../lib/adminSidebarApi";

const BRAND_SWATCHES = [
  { name: "Blue", h: 211, s: 92, l: 60 },
  { name: "Teal", h: 174, s: 70, l: 50 },
  { name: "Violet", h: 262, s: 83, l: 67 },
  { name: "Amber", h: 38, s: 92, l: 50 },
  { name: "Rose", h: 347, s: 77, l: 60 },
] as const;

const ICON_EMOJI_MAP: Record<string, string> = {
  home: "🏠",
  dashboard: "📊",
  transactions: "🧾",
  budgets: "💰",
  wallet: "👛",
  goals: "🎯",
  debts: "📉",
  categories: "🏷️",
  data: "📂",
  subscriptions: "🔁",
  profile: "👤",
  settings: "⚙️",
  admin: "🛠️",
  report: "📄",
  reports: "📈",
  insight: "💡",
  analytics: "📈",
  saving: "💾",
  support: "🆘",
};

type SidebarAccessRole = "guest" | "user" | "admin";

type SidebarMenuItem = {
  id: string;
  title: string;
  route: string;
  icon_name: string | null;
  position: number;
};

type ThemeMode = "light" | "dark" | "system";

type BrandConfig = {
  h: number;
  s: number;
  l: number;
};

interface SidebarProps {
  collapsed: boolean;
  onToggle?: (collapsed: boolean) => void;
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  brand: BrandConfig;
  setBrand: (brand: BrandConfig) => void;
  onNavigate?: () => void;
  onClose?: () => void;
}

function isBrandSelected(current: BrandConfig, candidate: BrandConfig) {
  return current.h === candidate.h && current.s === candidate.s && current.l === candidate.l;
}

function formatEmail(email?: string | null) {
  if (!email) return "";
  return email.length > 24 ? `${email.slice(0, 21)}…` : email;
}

function renderSidebarIcon(name?: string | null) {
  if (!name) {
    return <span className="text-lg leading-none">•</span>;
  }
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return <span className="text-lg leading-none">•</span>;
  }
  const emoji = ICON_EMOJI_MAP[normalized];
  if (emoji) {
    return <span className="text-lg leading-none">{emoji}</span>;
  }
  const fallback = normalized.replace(/[^a-z0-9]/g, '').slice(0, 2).toUpperCase();
  return (
    <span className="text-[11px] font-semibold uppercase leading-none">
      {fallback || '•'}
    </span>
  );
}

export default function Sidebar({
  collapsed,
  onToggle,
  theme,
  setTheme,
  brand,
  setBrand,
  onNavigate,
  onClose,
}: SidebarProps) {
  const navigate = useNavigate();
  const { mode, setMode } = useMode();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<SidebarAccessRole>("guest");
  const [menuItems, setMenuItems] = useState<SidebarMenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const syncUser = async (user: User | null) => {
      if (!active) return;
      setSessionUser(user ?? null);
      if (!user) {
        setUserRole("guest");
        return;
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setUserRole("user");
        return;
      }

      const role = data?.role === "admin" ? "admin" : "user";
      setUserRole(role);
    };

    supabase.auth.getUser().then(({ data }) => {
      void syncUser(data.user ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void syncUser(session?.user ?? null);
      }
    );

    return () => {
      active = false;
      subscription.subscription?.unsubscribe?.();
    };
  }, []);

  const fetchMenuItems = useCallback(
    async (role: SidebarAccessRole) => {
      setMenuLoading(true);
      setMenuError(null);
      try {
        const items = await listSidebarItems();
        const allowedLevels =
          role === "admin"
            ? new Set(["public", "user", "admin"])
            : role === "user"
            ? new Set(["public", "user"])
            : new Set(["public"]);
        const filtered = items
          .filter((item) => item.is_enabled && allowedLevels.has(item.access_level))
          .map<SidebarMenuItem>((item) => ({
            id: item.id,
            title: item.title?.trim() || item.route,
            route: item.route,
            icon_name: item.icon_name ?? null,
            position: item.position,
          }))
          .sort((a, b) => a.position - b.position);
        setMenuItems(filtered);
      } catch (_error) {
        setMenuItems([]);
        setMenuError("Gagal memuat menu sidebar");
      } finally {
        setMenuLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchMenuItems(userRole);
  }, [userRole, fetchMenuItems]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onNavigate?.();
  };

  const themeOptions: { value: ThemeMode; label: string; icon: JSX.Element }[] = [
    { value: "light", label: "Sun", icon: <Sun className="h-4 w-4" /> },
    { value: "system", label: "Auto", icon: <Monitor className="h-4 w-4" /> },
    { value: "dark", label: "Moon", icon: <Moon className="h-4 w-4" /> },
  ];

  const modeOptions: { value: "local" | "online"; label: string; icon: JSX.Element }[] = [
    { value: "local", label: "Local", icon: <CloudOff className="h-4 w-4" /> },
    { value: "online", label: "Online", icon: <Cloud className="h-4 w-4" /> },
  ];

  return (
    <>
      <nav
        role="navigation"
        aria-label="Main"
        className={clsx(
          "relative flex h-full min-h-0 min-w-0 w-full flex-col bg-surface-1/95 text-text transition-[background,color] duration-200",
          collapsed ? "px-2" : "px-4"
        )}
      >
        <div
          className={clsx(
            "flex items-center gap-3 pt-6",
            collapsed ? "justify-center pb-4" : "justify-between pb-6"
          )}
        >
          <div className={clsx("flex items-center gap-3", collapsed && "flex-col")}
>
            <Logo className="h-9 w-9 shrink-0" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-[17px] font-semibold leading-none tracking-tight">
                  HematWoi
                </span>
                <span className="mt-1 text-xs text-muted">
                  Atur keuangan kamu dengan tenang
                </span>
              </div>
            )}
          </div>
          {onClose ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-text shadow-sm"
              onClick={onClose}
              data-autofocus="true"
              aria-label="Tutup navigasi"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain pb-6">
          <SidebarSection title="Main" collapsed={collapsed}>
            {menuLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className={clsx(
                      'h-11 w-full rounded-xl bg-border/50',
                      collapsed && 'mx-auto w-11'
                    )}
                  />
                ))}
              </div>
            ) : menuItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-surface-2/60 p-3 text-xs text-muted-foreground">
                {menuError ?? 'Menu sidebar belum dikonfigurasi.'}
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <SidebarItem
                      to={item.route}
                      icon={renderSidebarIcon(item.icon_name)}
                      label={item.title}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SidebarSection>
          <SidebarSection title="Preferensi" collapsed={collapsed}>
            <div>
              <p
                className={clsx(
                  "px-3 text-xs font-semibold text-muted",
                  collapsed && "sr-only"
                )}
              >
                Mode Tampilan
              </p>
              <div
                role="radiogroup"
                aria-label="Tema aplikasi"
                className={clsx(
                  "mt-2 grid gap-2",
                  collapsed ? "grid-cols-1" : "grid-cols-3"
                )}
              >
                {themeOptions.map((option) => {
                  const isActive = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setTheme(option.value)}
                      className={clsx(
                        "flex items-center justify-center gap-2 rounded-xl border border-border px-2 py-2 text-xs font-medium transition-colors duration-200",
                        isActive
                          ? "border-brand/60 bg-brand/15 text-brand"
                          : "bg-transparent text-muted hover:border-border/80 hover:bg-muted/10",
                        collapsed && "flex-col gap-1 px-1 py-1 text-[11px]"
                      )}
                    >
                      {option.icon}
                      {!collapsed && <span>{option.label}</span>}
                      {collapsed && <span className="sr-only">{option.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p
                className={clsx(
                  "px-3 text-xs font-semibold text-muted",
                  collapsed && "sr-only"
                )}
              >
                Brand
              </p>
              <div
                role="radiogroup"
                aria-label="Warna merek"
                className={clsx(
                  "mt-2 grid grid-cols-5 gap-2",
                  collapsed && "grid-cols-1"
                )}
              >
                {BRAND_SWATCHES.map((preset) => {
                  const isActive = isBrandSelected(brand, preset);
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={preset.name}
                      onClick={() => setBrand(preset)}
                      className={clsx(
                        "relative flex h-8 w-full items-center justify-center rounded-full border border-border transition-all duration-200",
                        isActive
                          ? "ring-2 ring-brand/70"
                          : "hover:border-border/70"
                      )}
                    >
                      <span
                        className="h-5 w-5 rounded-full"
                        style={{
                          backgroundColor: `hsl(${preset.h} ${preset.s}% ${preset.l}%)`,
                        }}
                      />
                      {collapsed && (
                        <span className="sr-only">{preset.name}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </SidebarSection>
          <SidebarSection title="Mode" collapsed={collapsed}>
            <div
              role="group"
              aria-label="Mode sinkronisasi"
              className="grid grid-cols-2 gap-2"
            >
              {modeOptions.map((option) => {
                const isActive = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setMode(option.value)}
                    className={clsx(
                      "flex items-center justify-center gap-2 rounded-xl border border-border px-2 py-2 text-xs font-semibold transition-colors duration-200",
                      isActive
                        ? "border-brand/60 bg-brand/15 text-brand"
                        : "bg-transparent text-muted hover:border-border/80 hover:bg-muted/10"
                    )}
                  >
                    {option.icon}
                    {!collapsed && <span>{option.label}</span>}
                    {collapsed && <span className="sr-only">{option.label}</span>}
                  </button>
                );
              })}
            </div>
          </SidebarSection>
        </div>
        <footer
          className={clsx(
            "border-t border-border/60 py-4",
            collapsed ? "px-2" : "px-4"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {sessionUser ? (
                <p
                  className={clsx(
                    "truncate text-sm font-medium",
                    collapsed && "sr-only"
                  )}
                >
                  {formatEmail(sessionUser.email)}
                </p>
              ) : (
                <p
                  className={clsx(
                    "text-sm text-muted",
                    collapsed && "sr-only"
                  )}
                >
                  Belum masuk
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {sessionUser ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-text transition-colors duration-200 hover:border-brand/50 hover:text-brand"
                >
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Keluar</span>}
                  {collapsed && <span className="sr-only">Keluar</span>}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    navigate("/auth");
                    onNavigate?.();
                  }}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-text transition-colors duration-200 hover:border-brand/50 hover:text-brand"
                >
                  <LogIn className="h-4 w-4" />
                  {!collapsed && <span>Masuk</span>}
                  {collapsed && <span className="sr-only">Masuk</span>}
                </button>
              )}
              <button
                type="button"
                onClick={() => onToggle?.(!collapsed)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-text transition-colors duration-200 hover:border-brand/40 hover:text-brand"
                title={collapsed ? "Perluas" : "Ciutkan"}
                aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </footer>
      </nav>
    </>
  );
}
