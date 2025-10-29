import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Cloud,
  CloudOff,
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
import { Icon } from "../icons";

const BRAND_SWATCHES = [
  { name: "Blue", h: 211, s: 92, l: 60 },
  { name: "Teal", h: 174, s: 70, l: 50 },
  { name: "Violet", h: 262, s: 83, l: 67 },
  { name: "Amber", h: 38, s: 92, l: 50 },
  { name: "Rose", h: 347, s: 77, l: 60 },
] as const;

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

type SidebarMenuEntry = {
  id: string;
  title: string;
  route: string;
  access_level: 'public' | 'user' | 'admin';
  icon_name: string | null;
  position: number;
  category: string | null;
};

const CALENDAR_FALLBACK: SidebarMenuEntry = {
  id: 'local-calendar',
  title: 'Kalender',
  route: '/calendar',
  access_level: 'user',
  icon_name: 'calendar',
  position: 900,
  category: null,
};

const MENU_STORAGE_PREFIX = "hw:sidebar-menu:";

function getMenuStorageKey(role: 'guest' | 'user' | 'admin') {
  return `${MENU_STORAGE_PREFIX}${role}`;
}

function loadCachedMenu(role: 'guest' | 'user' | 'admin'): SidebarMenuEntry[] | null {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getMenuStorageKey(role));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is SidebarMenuEntry => {
      return (
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.route === "string" &&
        (item.access_level === "public" || item.access_level === "user" || item.access_level === "admin") &&
        (typeof item.icon_name === "string" || item.icon_name === null) &&
        typeof item.position === "number" &&
        (typeof item.category === "string" || item.category === null)
      );
    });
  } catch (error) {
    console.warn("Gagal membaca cache menu sidebar", error);
    return null;
  }
}

function saveCachedMenu(role: 'guest' | 'user' | 'admin', items: SidebarMenuEntry[]): void {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return;
  }

  try {
    window.localStorage.setItem(getMenuStorageKey(role), JSON.stringify(items));
  } catch (error) {
    console.warn("Gagal menyimpan cache menu sidebar", error);
  }
}

function normalizeSidebarRoute(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  let collapsed = '';
  let previousSlash = false;

  for (const char of withLeading) {
    if (char === '/') {
      if (previousSlash) continue;
      previousSlash = true;
    } else {
      previousSlash = false;
    }
    collapsed += char;
  }

  while (collapsed.length > 1 && collapsed.endsWith('/')) {
    collapsed = collapsed.slice(0, -1);
  }

  return collapsed;
}

function ensureCalendarItem(
  items: SidebarMenuEntry[],
  role: 'guest' | 'user' | 'admin',
): SidebarMenuEntry[] {
  if (role === 'guest') {
    return items;
  }
  if (items.some((item) => item.route === '/calendar')) {
    return items;
  }
  const maxPosition = items.reduce((acc, item) => Math.max(acc, item.position ?? 0), 0);
  return [
    ...items,
    {
      ...CALENDAR_FALLBACK,
      position: maxPosition + 1,
    },
  ];
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
  const { mode, setMode } = useMode();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [menuItems, setMenuItems] = useState<SidebarMenuEntry[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setSessionUser(data.user ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSessionUser(session?.user ?? null);
      }
    );
    return () => {
      mounted = false;
      subscription.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMenuItems = async () => {
      try {
        let role: 'guest' | 'user' | 'admin' = 'guest';
        if (sessionUser) {
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', sessionUser.id)
            .maybeSingle();

          if (profileError) {
            throw profileError;
          }

          role = profile?.role === 'admin' ? 'admin' : 'user';
        }

        if (cancelled) return;

        const allowedLevels =
          role === 'admin'
            ? ['public', 'user', 'admin']
            : role === 'user'
              ? ['public', 'user']
              : ['public'];

        const cached = loadCachedMenu(role);
        const shouldShowLoader = !cached || cached.length === 0;

        setMenuLoading(shouldShowLoader);
        if (cached && !cancelled) {
          setMenuItems(ensureCalendarItem(cached, role));
        }

        let query = supabase
          .from('app_sidebar_items')
          .select('id, title, route, access_level, icon_name, position, is_enabled, category')
          .eq('is_enabled', true)
          .order('position', { ascending: true });

        if (allowedLevels.length === 1) {
          query = query.eq('access_level', allowedLevels[0]);
        } else {
          query = query.in('access_level', allowedLevels);
        }

        const { data: rows, error: menuError } = await query;

        if (menuError) {
          throw menuError;
        }

        if (cancelled) return;

        const normalized = (rows ?? []).map((row) => ({
          id: String(
            row?.id ??
              row?.route ??
              globalThis.crypto?.randomUUID?.() ??
              Math.random().toString(36).slice(2)
          ),
          title: String(row?.title ?? ''),
          route: normalizeSidebarRoute(String(row?.route ?? '/')),
          access_level:
            row?.access_level === 'admin'
              ? 'admin'
              : row?.access_level === 'user'
                ? 'user'
                : 'public',
          icon_name:
            typeof row?.icon_name === 'string'
              ? row.icon_name
              : row?.icon_name == null
                ? null
                : String(row.icon_name),
          position:
            typeof row?.position === 'number' && Number.isFinite(row.position)
              ? row.position
              : Number.parseInt(String(row?.position ?? 0), 10) || 0,
          category:
            typeof row?.category === 'string'
              ? row.category
              : row?.category == null
                ? null
                : String(row.category),
        }));

        const enriched = ensureCalendarItem(normalized, role);
        setMenuItems(enriched);
        saveCachedMenu(role, enriched);
      } catch (error) {
        if (!cancelled) {
          setMenuItems([]);
        }
      } finally {
        if (!cancelled) {
          setMenuLoading(false);
        }
      }
    };

    void loadMenuItems();

    return () => {
      cancelled = true;
    };
  }, [sessionUser]);

  const themeOptions: { value: ThemeMode; label: string; icon: JSX.Element }[] = [
    { value: "light", label: "Sun", icon: <Sun className="h-4 w-4" /> },
    { value: "system", label: "Auto", icon: <Monitor className="h-4 w-4" /> },
    { value: "dark", label: "Moon", icon: <Moon className="h-4 w-4" /> },
  ];

  const modeOptions: { value: "local" | "online"; label: string; icon: JSX.Element }[] = [
    { value: "local", label: "Local", icon: <CloudOff className="h-4 w-4" /> },
    { value: "online", label: "Online", icon: <Cloud className="h-4 w-4" /> },
  ];

  const menuSections = useMemo(() => {
    if (menuItems.length === 0) {
      return [] as { key: string; title: string; items: SidebarMenuEntry[] }[];
    }

    const groups = new Map<string, { key: string; title: string; items: SidebarMenuEntry[] }>();

    for (const item of menuItems) {
      const rawCategory = (item.category ?? '').trim();
      const key = rawCategory ? rawCategory.toLocaleLowerCase('id-ID') : '__default__';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: rawCategory || 'Main',
          items: [],
        });
      }
      groups.get(key)?.items.push(item);
    }

    return Array.from(groups.values());
  }, [menuItems]);

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
          {menuLoading ? (
            <SidebarSection title="Main" collapsed={collapsed}>
              <ul className="flex flex-col gap-1.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <li key={`sidebar-skeleton-${index}`}>
                    <div
                      className={clsx(
                        'h-11 w-full animate-pulse rounded-xl bg-border/60',
                        collapsed && 'mx-auto w-11 rounded-full'
                      )}
                    />
                  </li>
                ))}
              </ul>
            </SidebarSection>
          ) : menuSections.length === 0 ? (
            <SidebarSection title="Main" collapsed={collapsed}>
              <ul className="flex flex-col gap-1.5">
                <li>
                  <div
                    className={clsx(
                      'rounded-2xl border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground',
                      collapsed && 'text-center'
                    )}
                  >
                    Menu belum tersedia
                  </div>
                </li>
              </ul>
            </SidebarSection>
          ) : (
            menuSections.map((section) => (
              <SidebarSection key={section.key} title={section.title} collapsed={collapsed}>
                <ul className="flex flex-col gap-1.5">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <SidebarItem
                        to={item.route}
                        icon={
                          <Icon
                            name={item.icon_name}
                            label={item.title || item.route}
                            className="w-5 h-5 shrink-0"
                          />
                        }
                        label={item.title || item.route}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                      />
                    </li>
                  ))}
                </ul>
              </SidebarSection>
            ))
          )}
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
        />
      </nav>
    </>
  );
}
