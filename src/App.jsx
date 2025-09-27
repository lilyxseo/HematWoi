import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
  NavLink,
} from "react-router-dom";
import clsx from "clsx";
import {
  Home,
  Wallet,
  PiggyBank,
  ListChecks,
  BarChart3,
  Settings as SettingsIcon,
  Menu,
  Bell,
  ChevronDown,
  LogOut,
} from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import BootGate from "./components/BootGate";

import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import DebtsPage from "./pages/Debts";
import Categories from "./pages/Categories";
import DataPage from "./pages/DataPage";
import TransactionAdd from "./pages/TransactionAdd";
import Subscriptions from "./pages/Subscriptions";
import ImportWizard from "./pages/ImportWizard";
import GoalsPage from "./pages/Goals";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/Profile";
import AccountsPage from "./pages/AccountsPage";
import AuthLogin from "./pages/AuthLogin";
import AdminPage from "./pages/AdminPage";
import ChallengesPage from "./pages/Challenges.jsx";
import useChallenges from "./hooks/useChallenges.js";
import AuthGuard from "./components/AuthGuard";
import AdminGuard from "./components/AdminGuard";
import { DataProvider } from "./context/DataContext";

import { supabase } from "./lib/supabase";
import { syncGuestToCloud } from "./lib/sync";
import { playChaChing } from "./lib/walletSound";
import {
  listTransactions,
  addTransaction as apiAdd,
  updateTransaction as apiUpdate,
  upsertCategories,
  listCategories as apiListCategories,
} from "./lib/api";
import { removeTransaction as apiDelete } from "./lib/api-transactions";

import CategoryProvider from "./context/CategoryContext";
import ToastProvider, { useToast } from "./context/ToastContext";
import UserProfileProvider from "./context/UserProfileContext.jsx";
import { loadSubscriptions, findUpcoming } from "./lib/subscriptions";
import { allocateIncome } from "./lib/goals";
import MoneyTalkProvider, {
  useMoneyTalk,
} from "./context/MoneyTalkContext.jsx";
import { ModeProvider, useMode } from "./hooks/useMode";
import AuthCallback from "./pages/AuthCallback";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const defaultCategories = {
  income: ["Gaji", "Bonus", "Lainnya"],
  expense: [
    "Makan",
    "Transport",
    "Belanja",
    "Tagihan",
    "Tabungan",
    "Kesehatan",
    "Hiburan",
    "Lainnya",
  ],
};

const BRAND_PRESETS = {
  blue: { h: 211, s: 92, l: 60 },
  teal: { h: 174, s: 70, l: 50 },
  violet: { h: 262, s: 83, l: 67 },
  amber: { h: 38, s: 92, l: 50 },
  rose: { h: 347, s: 77, l: 60 },
};

const SIDEBAR_ITEMS = [
  { label: "Dashboard", to: "/", icon: Home },
  { label: "Transaksi", to: "/transactions", icon: Wallet },
  { label: "Anggaran", to: "/budgets", icon: PiggyBank },
  { label: "Kategori", to: "/categories", icon: ListChecks },
  { label: "Laporan", to: "/data", icon: BarChart3 },
  { label: "Pengaturan", to: "/settings", icon: SettingsIcon },
];

function normalizeBudgetRecord(budget, overrides = {}) {
  if (!budget) return null;

  const {
    amount,
    amount_planned,
    carryover,
    carryover_enabled,
    note,
    notes,
    limit,
    cap,
    month,
    ...rest
  } = budget;

  const {
    amount_planned: overridePlanned,
    carryover_enabled: overrideCarryover,
    notes: overrideNotes,
    month: overrideMonth,
    ...extra
  } = overrides;

  const plannedSource =
    overridePlanned ?? amount_planned ?? amount ?? limit ?? cap ?? 0;
  const plannedValue = Number(plannedSource);
  const normalizedPlanned = Number.isFinite(plannedValue)
    ? plannedValue
    : 0;

  const carryoverSource =
    overrideCarryover ?? carryover_enabled ?? carryover ?? false;
  const normalizedCarryover =
    typeof carryoverSource === "string"
      ? carryoverSource === "true"
      : Boolean(carryoverSource);

  const resolvedNotes = overrideNotes ?? notes ?? note ?? null;

  const monthSource = overrideMonth ?? month;
  const normalizedMonth = monthSource ? String(monthSource).slice(0, 7) : null;

  return {
    ...rest,
    ...extra,
    month: normalizedMonth,
    amount_planned: normalizedPlanned,
    carryover_enabled: normalizedCarryover,
    notes: resolvedNotes,
  };
}

function loadInitial() {
  try {
    const raw = localStorage.getItem("hematwoi:v3");
    if (!raw)
      return {
        txs: [],
        cat: defaultCategories,
        budgets: [],
        goals: [],
        envelopes: [],
        budgetStatus: [],
      };
    const parsed = JSON.parse(raw);
    return {
      txs: parsed.txs || [],
      cat: parsed.cat || defaultCategories,
      budgets: Array.isArray(parsed.budgets)
        ? parsed.budgets
            .map((item) => normalizeBudgetRecord(item))
            .filter(Boolean)
        : [],
      goals: parsed.goals || [],
      envelopes: parsed.envelopes || [],
      budgetStatus: Array.isArray(parsed.budgetStatus)
        ? parsed.budgetStatus
        : [],
    };
  } catch {
    return {
      txs: [],
      cat: defaultCategories,
      budgets: [],
      goals: [],
      envelopes: [],
      budgetStatus: [],
    };
  }
}

function ProtectedAppContainer({ layoutState, sessionUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const hideNav = location.pathname.startsWith("/add");
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarMini,
    setSidebarMini,
    profileOpen,
    setProfileOpen,
  } = layoutState;
  const profileButtonRef = useRef(null);

  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
  }, [location.pathname, setProfileOpen, setSidebarOpen]);

  const sidebarItems = useMemo(() => SIDEBAR_ITEMS, []);

  const displayName = useMemo(() => {
    const name = sessionUser?.user_metadata?.full_name?.trim();
    if (name) return name;
    if (sessionUser?.email) return sessionUser.email;
    return "Pengguna";
  }, [sessionUser]);

  const email = useMemo(() => {
    if (sessionUser?.email) return sessionUser.email;
    return sessionUser?.user_metadata?.email ?? "";
  }, [sessionUser]);

  const initials = useMemo(() => {
    if (!displayName) return "HW";
    const tokens = displayName
      .split(/\s+/)
      .map((token) => token[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return tokens || "HW";
  }, [displayName]);

  const avatarUrl =
    sessionUser?.user_metadata?.avatar_url ||
    sessionUser?.user_metadata?.avatar ||
    null;

  const handleToggleProfile = useCallback(() => {
    setProfileOpen((prev) => !prev);
  }, [setProfileOpen]);

  const handleCloseProfile = useCallback(() => {
    setProfileOpen(false);
  }, [setProfileOpen]);

  const handleOpenProfile = useCallback(() => {
    navigate("/profile");
  }, [navigate]);

  const handleOpenSettingsPanel = useCallback(() => {
    window.dispatchEvent(new CustomEvent("hw:open-settings"));
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (error) {
      console.error("Gagal keluar", error);
    }
  }, []);

  const renderSidebarContent = useCallback(
    (mini, onNavigate) => (
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
        <SidebarSection label="Menu Utama" mini={mini}>
          {sidebarItems.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              mini={mini}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarSection>
      </nav>
    ),
    [sidebarItems]
  );

  const handleSidebarBlur = useCallback(
    (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setSidebarMini(true);
      }
    },
    [setSidebarMini]
  );

  if (hideNav) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-6">
            <div className="mx-auto w-full max-w-[1280px] space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Outlet />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-[#3898f8] px-3 text-white shadow-sm sm:px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Buka navigasi"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3898f8] sm:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
            <span className="sr-only">Buka menu samping</span>
          </button>
          <span className="hidden text-sm font-semibold tracking-tight sm:block">
            HematWoi
          </span>
        </div>
        <TopbarRight
          profileButtonRef={profileButtonRef}
          profileOpen={profileOpen}
          onToggleProfile={handleToggleProfile}
          onCloseProfile={handleCloseProfile}
          onSelectProfile={handleOpenProfile}
          onSelectSettings={handleOpenSettingsPanel}
          onSelectLogout={handleSignOut}
          initials={initials}
          avatarUrl={avatarUrl}
          displayName={displayName}
          email={email}
        />
      </header>
      <div className="flex flex-1">
        <aside
          className={clsx(
            "sticky top-14 hidden h-[calc(100vh-56px)] flex-col border-r border-slate-200 bg-white shadow-sm transition-[width] duration-200 sm:flex",
            sidebarMini ? "w-16" : "w-64"
          )}
          onMouseEnter={() => setSidebarMini(false)}
          onMouseLeave={() => setSidebarMini(true)}
          onFocusCapture={() => setSidebarMini(false)}
          onBlur={handleSidebarBlur}
        >
          {renderSidebarContent(sidebarMini)}
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-6">
            <div className="mx-auto w-full max-w-[1280px] space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Outlet />
              </div>
            </div>
          </div>
        </main>
      </div>

      {sidebarOpen ? (
        <div className="sm:hidden">
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Tutup navigasi"
              className="absolute inset-0 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-slate-200 bg-white p-2 shadow-xl animate-in slide-in-from-left">
              <div className="flex h-14 items-center px-2 text-base font-semibold text-slate-900">
                HematWoi
              </div>
              {renderSidebarContent(false, () => setSidebarOpen(false))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SidebarSection({ label, mini, children }) {
  const displayLabel = mini ? label.charAt(0) : label;
  return (
    <div className="px-2">
      <div
        className={clsx(
          "px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-all duration-200",
          mini ? "text-center" : "text-left"
        )}
      >
        {displayLabel}
      </div>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

function SidebarItem({ to, icon, label, mini, onNavigate }) {
  const Icon = icon;
  return (
    <NavLink
      to={to}
      end={to === "/"}
      aria-label={label}
      className={({ isActive }) =>
        clsx(
          "group flex items-center gap-3 rounded-xl border-l-2 border-transparent px-2 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3898f8]",
          isActive && "border-[#3898f8] bg-[#3898f8]/10 text-[#3898f8]"
        )
      }
      onClick={() => {
        if (onNavigate) onNavigate();
      }}
    >
      <span className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span
        className={clsx(
          "overflow-hidden whitespace-nowrap text-sm font-medium text-slate-700 transition-all duration-200",
          mini ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        {label}
      </span>
    </NavLink>
  );
}

function TopbarRight({
  profileButtonRef,
  profileOpen,
  onToggleProfile,
  onCloseProfile,
  onSelectProfile,
  onSelectSettings,
  onSelectLogout,
  initials,
  avatarUrl,
  displayName,
  email,
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        type="button"
        aria-label="Lihat notifikasi"
        className="relative inline-flex items-center justify-center rounded-lg p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3898f8]"
      >
        <Bell className="size-5" aria-hidden="true" />
        <span className="absolute right-1 top-1 inline-flex h-2 w-2 animate-pulse rounded-full bg-white" />
      </button>
      <div className="relative">
        <button
          type="button"
          ref={profileButtonRef}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          onClick={onToggleProfile}
          className="flex items-center gap-2 rounded-full pl-2 pr-1 py-1 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3898f8]"
        >
          <div className="relative flex size-9 items-center justify-center overflow-hidden rounded-full bg-white/20 text-sm font-semibold uppercase">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar profil"
                className="size-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <span className="hidden text-sm font-medium text-white/90 sm:inline-block">
            {displayName}
          </span>
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
        <ProfileDropdown
          open={profileOpen}
          anchorRef={profileButtonRef}
          onClose={onCloseProfile}
          onSelectProfile={onSelectProfile}
          onSelectSettings={onSelectSettings}
          onSelectLogout={onSelectLogout}
          initials={initials}
          avatarUrl={avatarUrl}
          displayName={displayName}
          email={email}
        />
      </div>
    </div>
  );
}

function ProfileDropdown({
  open,
  anchorRef,
  onClose,
  onSelectProfile,
  onSelectSettings,
  onSelectLogout,
  initials,
  avatarUrl,
  displayName,
  email,
}) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !(anchorRef?.current && anchorRef.current.contains(event.target))
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [anchorRef, onClose, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, open]);

  const handleSelect = (callback) => () => {
    onClose();
    if (callback) callback();
  };

  return (
    <div
      ref={dropdownRef}
      className={clsx(
        "absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-lg ring-1 ring-black/5 transition duration-150 ease-out",
        open ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
      )}
      role="menu"
      aria-hidden={!open}
    >
      <div className="flex items-center gap-3 rounded-lg px-3 py-2">
        <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-[#3898f8]/10 text-sm font-semibold text-[#3898f8]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
          {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
        </div>
      </div>
      <div className="mt-1 space-y-1" role="none">
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3898f8]"
          onClick={handleSelect(onSelectProfile)}
        >
          <span className="flex-1 text-left">Profil</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3898f8]"
          onClick={handleSelect(onSelectSettings)}
        >
          <SettingsIcon className="size-4 text-slate-500" aria-hidden="true" />
          <span className="flex-1 text-left">Pengaturan</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3898f8]"
          onClick={handleSelect(onSelectLogout)}
        >
          <LogOut className="size-4" aria-hidden="true" />
          <span className="flex-1 text-left">Keluar</span>
        </button>
      </div>
    </div>
  );
}

function AppShell({ prefs, setPrefs, layoutState }) {
  const { mode, setMode } = useMode();
  const [data, setData] = useState(loadInitial);
  const [filter, setFilter] = useState({
    type: "all",
    q: "",
    month: "all",
    category: "all",
    sort: "date-desc",
  });
  const currentMonth = new Date().toISOString().slice(0, 7);
  const storedTheme = () => {
    try {
      const t = JSON.parse(localStorage.getItem('hwTheme') || '{}');
      return t.mode || 'system';
    } catch {
      return 'system';
    }
  };
  const storedBrand = () => {
    try {
      const t = JSON.parse(localStorage.getItem('hwTheme') || '{}');
      return t.brand || BRAND_PRESETS.blue;
    } catch {
      return BRAND_PRESETS.blue;
    }
  };
  const [theme, setTheme] = useState(storedTheme);
  const [brand, setBrand] = useState(storedBrand);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profileSyncEnabled, setProfileSyncEnabled] = useState(true);
  const syncedUsersRef = useRef(new Set());
  const syncGuestData = useCallback(async (userId) => {
    if (!userId) return;
    if (syncedUsersRef.current.has(userId)) return;
    try {
      await syncGuestToCloud(supabase, userId);
      syncedUsersRef.current.add(userId);
    } catch (error) {
      console.error('Gagal memindahkan data lokal ke cloud', error);
      syncedUsersRef.current.delete(userId);
    }
  }, []);
  const useCloud = mode === "online";
  const [catMeta, setCatMeta] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hematwoi:v3:catMeta")) || {};
    } catch {
      return {};
    }
  });
  const [catMap, setCatMap] = useState({});
  const categoryNameById = useCallback(
    (id) => {
      if (!id) return null;
      for (const [name, value] of Object.entries(catMap)) {
        if (value === id) return name;
      }
      return null;
    },
    [catMap]
  );
  const [rules, setRules] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hematwoi:v3:rules")) || {};
    } catch {
      return {};
    }
  });
  const [allocRules] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("hematwoi:v3:alloc")) || {
          goals: {},
          envelopes: {},
        }
      );
    } catch {
      return { goals: {}, envelopes: {} };
    }
  });
  const { addToast } = useToast();
  const { challenges, addChallenge, updateChallenge, removeChallenge } =
    useChallenges(data.txs);
  const { speak } = useMoneyTalk();
  window.__hw_prefs = prefs;

  const navigate = useNavigate();


  const handleProfileSyncError = useCallback(
    (error, context) => {
      if (!error) return false;
      const code = error.code;
      const status = error.status ?? error.statusCode;
      const message = String(error.message || "").toLowerCase();
      const mentionsProfiles = message.includes("profile");
      const notFoundMessage =
        message.includes("not found") ||
        message.includes("does not exist") ||
        message.includes("unknown");
      const isMissingTable =
        code === "42P01" ||
        code === "PGRST116" ||
        code === "PGRST114" ||
        status === 404 ||
        (mentionsProfiles && notFoundMessage);
      if (isMissingTable) {
        if (profileSyncEnabled) {
          console.warn(
            `Menonaktifkan sinkronisasi profil karena tabel Supabase tidak tersedia (${context || "profiles"})`,
            error
          );
          setProfileSyncEnabled(false);
        }
        return true;
      }
      return false;
    },
    [profileSyncEnabled]
  );

  useEffect(() => {
    let isMounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        const session = data.session ?? null;
        if (session?.user) {
          try {
            localStorage.setItem("hw:connectionMode", "online");
            localStorage.setItem("hw:mode", "online");
          } catch {
            /* ignore */
          }
          setMode("online");
          void syncGuestData(session.user.id);
        } else {
          syncedUsersRef.current.clear();
        }
        setSessionUser(session?.user ?? null);
        setSessionChecked(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setSessionUser(null);
        setSessionChecked(true);
        syncedUsersRef.current.clear();
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setSessionUser(session?.user ?? null);
      setSessionChecked(true);
      if (event === "SIGNED_IN") {
        try {
          localStorage.setItem("hw:connectionMode", "online");
          localStorage.setItem("hw:mode", "online");
        } catch {
          /* ignore */
        }
        setMode("online");
        if (session?.user?.id) {
          void syncGuestData(session.user.id);
        }
      }
      if (event === "SIGNED_OUT") {
        syncedUsersRef.current.clear();
      }
    });
    return () => {
      isMounted = false;
      sub.subscription?.unsubscribe();
    };
  }, [setMode, syncGuestData]);

  useEffect(() => {
    if (sessionChecked && !sessionUser && mode === "online") {
      setMode("local");
    }
  }, [sessionChecked, sessionUser, mode, setMode]);

  useEffect(() => {
    const root = document.documentElement;
    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = theme === 'system' ? (sysDark ? 'dark' : 'light') : theme;
    root.setAttribute('data-theme', mode);
    localStorage.setItem('hwTheme', JSON.stringify({ mode: theme, brand }));
  }, [theme, brand]);

  useEffect(() => {
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const root = document.documentElement;
    root.style.setProperty('--brand-h', String(brand.h));
    root.style.setProperty('--brand-s', `${brand.s}%`);
    root.style.setProperty('--brand-l', `${brand.l}%`);

    const currentTheme = root.getAttribute('data-theme') ?? 'light';
    const isDark = currentTheme === 'dark';

    const hoverLightness = clamp(brand.l + (isDark ? 6 : -7), isDark ? 18 : 8, isDark ? 96 : 92);
    const activeLightness = clamp(brand.l + (isDark ? 10 : -12), isDark ? 15 : 6, isDark ? 98 : 88);
    const softLightness = clamp(isDark ? brand.l / 2 : brand.l + 32, isDark ? 18 : 70, isDark ? 42 : 96);
    const ringLightness = clamp(brand.l + (isDark ? 4 : -14), 0, 100);

    root.style.setProperty('--color-primary-hover', `${brand.h} ${brand.s}% ${hoverLightness}%`);
    root.style.setProperty('--color-primary-active', `${brand.h} ${brand.s}% ${activeLightness}%`);
    root.style.setProperty('--color-primary-soft', `${brand.h} ${brand.s}% ${softLightness}%`);
    root.style.setProperty('--brand-soft', `hsl(${brand.h} ${brand.s}% ${softLightness}%)`);
    root.style.setProperty('--brand-ring', `hsl(${brand.h} ${brand.s}% ${ringLightness}%)`);
    root.style.setProperty('--brand', `hsl(${brand.h} ${brand.s}% ${brand.l}%)`);

    const useDarkForeground = brand.l > 65;
    root.style.setProperty(
      '--color-primary-foreground',
      useDarkForeground ? '0 0% 10%' : '0 0% 100%'
    );
    root.style.setProperty(
      '--brand-foreground',
      useDarkForeground ? '#0b1220' : '#ffffff'
    );
  }, [brand, theme]);

  useEffect(() => {
    const preset = BRAND_PRESETS[prefs.accent];
    if (preset) setBrand(preset);
  }, [prefs.accent]);

  useEffect(() => {
    localStorage.setItem("hematwoi:v3:prefs", JSON.stringify(prefs));
    window.__hw_prefs = prefs;
  }, [prefs]);

  useEffect(() => {
    async function loadProfile() {
      if (!useCloud || !sessionUser || !profileSyncEnabled) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", sessionUser.id)
          .maybeSingle();
        if (error) {
          if (!handleProfileSyncError(error, "load")) {
            console.error("Gagal memuat preferensi profil", error);
          }
          return;
        }
        if (data?.preferences) {
          const p = data.preferences || {};
          if (p.theme) setTheme(p.theme);
          setPrefs((prev) => ({ ...prev, ...p }));
        }
      } catch (err) {
        console.error("Gagal memuat preferensi profil", err);
      }
    }
    loadProfile();
  }, [useCloud, sessionUser, setPrefs, profileSyncEnabled, handleProfileSyncError]);

  useEffect(() => {
    async function saveProfile() {
      if (!useCloud || !sessionUser || !profileSyncEnabled) return;
      try {
        const preferences = { ...prefs, theme };
        const { error } = await supabase
          .from("profiles")
          .upsert({ id: sessionUser.id, preferences })
          .select("id")
          .maybeSingle();
        if (error && !handleProfileSyncError(error, "save")) {
          console.error("Gagal menyimpan preferensi profil", error);
        }
      } catch (err) {
        console.error("Gagal menyimpan preferensi profil", err);
      }
    }
    saveProfile();
  }, [theme, prefs, useCloud, sessionUser, profileSyncEnabled, handleProfileSyncError]);

  useEffect(() => {
    const applied = sessionStorage.getItem("hw:applied-default-month");
    if (applied) return;
    const now = new Date();
    const current = now.toISOString().slice(0, 7);
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 7);
    if (prefs.defaultMonth === "current")
      setFilter((f) => ({ ...f, month: current }));
    else if (prefs.defaultMonth === "last")
      setFilter((f) => ({ ...f, month: last }));
    sessionStorage.setItem("hw:applied-default-month", "1");
  }, [prefs.defaultMonth]);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener("hw:open-settings", open);
    return () => window.removeEventListener("hw:open-settings", open);
  }, []);

  useEffect(() => {
    localStorage.setItem("hematwoi:v3", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem("hematwoi:v3:catMeta", JSON.stringify(catMeta));
  }, [catMeta]);

  useEffect(() => {
    localStorage.setItem("hematwoi:v3:rules", JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem("hematwoi:v3:alloc", JSON.stringify(allocRules));
  }, [allocRules]);

  const fetchCategoriesCloud = useCallback(async () => {
    try {
      const rows = await apiListCategories();
      const map = {};
      const meta = {};
      const incomeRows = [];
      const expenseRows = [];
      (rows || []).forEach((r) => {
        if (!r?.name) return;
        map[r.name] = r.id;
        meta[r.name] = {
          color: r.color || "#64748b",
          type: r.type,
          sort: r.order_index ?? 0,
        };
        if (r.type === "income") incomeRows.push(r);
        else expenseRows.push(r);
      });
      const sortByOrder = (a, b) => {
        const orderA = a.order_index ?? 0;
        const orderB = b.order_index ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      };
      incomeRows.sort(sortByOrder);
      expenseRows.sort(sortByOrder);
      setCatMap(map);
      setCatMeta(meta);
      setData((d) => ({
        ...d,
        cat: {
          income: incomeRows.map((r) => r.name),
          expense: expenseRows.map((r) => r.name),
        },
      }));
    } catch (e) {
      console.error("fetch categories failed", e);
    }
  }, []);

  const fetchTxsCloud = useCallback(async () => {
    try {
      const res = await listTransactions({ pageSize: 1000 });
      setData((d) => ({ ...d, txs: res.rows || [] }));
    } catch (e) {
      console.error("fetch transactions failed", e);
    }
  }, []);

  const fetchBudgetsCloud = useCallback(async () => {
    try {
      if (!sessionUser) return;
      const { data: rows, error } = await supabase
        .from("budgets")
        .select("id, month, amount_planned, carryover_enabled, notes, category_id")
        .eq("user_id", sessionUser.id)
        .order("month", { ascending: false });
      if (error) throw error;
      const categoriesById = {};
      const missingIds = [];
      (rows || []).forEach((row) => {
        if (!row?.category_id) return;
        if (!categoryNameById(row.category_id)) {
          missingIds.push(row.category_id);
        }
      });
      const uniqueMissing = Array.from(new Set(missingIds));
      if (uniqueMissing.length) {
        const { data: catRows, error: catError } = await supabase
          .from("categories")
          .select("id, name")
          .eq("user_id", sessionUser.id)
          .in("id", uniqueMissing);
        if (!catError && Array.isArray(catRows)) {
          catRows.forEach((item) => {
            if (item?.id && item?.name) {
              categoriesById[item.id] = item.name;
            }
          });
        }
      }
      if (Object.keys(categoriesById).length) {
        setCatMap((prev) => {
          const next = { ...prev };
          Object.entries(categoriesById).forEach(([id, name]) => {
            if (name && !next[name]) next[name] = id;
          });
          return next;
        });
      }
      const mapped = (rows || [])
        .map((row) => {
          const categoryLabel =
            (row?.category_id &&
              (categoryNameById(row.category_id) ||
                categoriesById[row.category_id])) ||
            row?.category ||
            row?.category_name ||
            "Tanpa kategori";
          return normalizeBudgetRecord(row, { category: categoryLabel });
        })
        .filter(Boolean);
      setData((d) => ({ ...d, budgets: mapped }));
    } catch (e) {
      console.error("fetch budgets failed", e);
      const detail = e?.message ? `: ${e.message}` : "";
      addToast(`Gagal memuat data anggaran${detail}`, "error");
    }
  }, [sessionUser, categoryNameById, addToast]);

  const fetchBudgetStatusCloud = useCallback(async () => {
    if (!sessionUser) return;
    const toNumber = (value) => {
      const parsed = Number.parseFloat(value ?? 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    try {
      const { data: rows, error } = await supabase
        .from("v_budget_status_month")
        .select("category_name, amount_planned, actual, pct")
        .order("pct", { ascending: false });
      if (error) throw error;
      const mapped = (rows || []).map((row) => ({
        category: row?.category_name || "Tanpa kategori",
        planned: toNumber(row?.amount_planned),
        actual: toNumber(row?.actual),
        pct: toNumber(row?.pct),
      }));
      setData((d) => ({ ...d, budgetStatus: mapped }));
    } catch (e) {
      console.error("fetch budget status failed", e);
      setData((d) => ({ ...d, budgetStatus: [] }));
    }
  }, [sessionUser]);

  useEffect(() => {
    if (useCloud && sessionUser) {
      fetchCategoriesCloud();
      fetchTxsCloud();
      fetchBudgetsCloud();
      fetchBudgetStatusCloud();
    }
  }, [
    useCloud,
    sessionUser,
    fetchCategoriesCloud,
    fetchTxsCloud,
    fetchBudgetsCloud,
    fetchBudgetStatusCloud,
  ]);

  const triggerMoneyTalk = (tx) => {
    const category = tx.category;
    const amount = Number(tx.amount || 0);
    const isSavings = (category || "").toLowerCase() === "tabungan";
    const catTx = data.txs.filter(
      (t) => t.category === category && t.type === tx.type
    );
    const amounts = catTx
      .map((t) => Number(t.amount || 0))
      .sort((a, b) => a - b);
    const p75 =
      amounts.length > 0 ? amounts[Math.floor(0.75 * (amounts.length - 1))] : 0;
    const isHigh = amount > p75;
    const month = tx.date?.slice(0, 7);
    const budget = data.budgets.find(
      (b) => b.category === category && b.month === month
    );
    let spent = data.txs
      .filter(
        (t) =>
          t.type === "expense" &&
          t.category === category &&
          t.date?.slice(0, 7) === month
      )
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    if (tx.type === "expense") spent += amount;
    const isOverBudget = budget
      ? spent > Number(budget.amount_planned || 0)
      : false;
    speak({
      category,
      amount,
      context: { isHigh, isSavings, isOverBudget },
    });
  };

  const addTx = async (tx) => {
    const alreadyPersisted = Boolean(tx && tx.__persisted);
    const payloadTx = alreadyPersisted ? { ...tx } : tx;
    if (alreadyPersisted) {
      delete payloadTx.__persisted;
    }
    const categoryId =
      payloadTx.category_id ??
      (payloadTx.category ? catMap[payloadTx.category] ?? null : null);
    const resolvedNote = payloadTx.notes ?? payloadTx.note ?? "";
    const receiptsPayload = Array.isArray(payloadTx.receipts) ? payloadTx.receipts : [];
    const merchantLabel = payloadTx.merchant_name ?? payloadTx.merchant ?? null;
    const accountLabel = payloadTx.account_name ?? payloadTx.account ?? null;
    const toAccountLabel = payloadTx.to_account_name ?? payloadTx.to_account ?? null;
    const baseCategoryName =
      payloadTx.category ?? payloadTx.category_name ?? categoryNameById(categoryId);

    const pushRecord = (record) => {
      const normalized = {
        ...record,
        amount: Number(record.amount ?? payloadTx.amount ?? 0),
      };
      setData((d) => {
        let goals = d.goals;
        let envelopes = d.envelopes;
        if (normalized.type === "income") {
          const alloc = allocateIncome(
            normalized.amount,
            d.goals,
            d.envelopes,
            allocRules
          );
          goals = alloc.goals;
          envelopes = alloc.envelopes;
        }
        return {
          ...d,
          txs: [normalized, ...d.txs],
          goals,
          envelopes,
        };
      });
      return normalized;
    };

    let finalRecord = null;

    if (alreadyPersisted) {
      finalRecord = pushRecord({
        ...payloadTx,
        category: baseCategoryName,
        category_id: payloadTx.category_id ?? categoryId,
        note: payloadTx.note ?? resolvedNote,
        merchant: payloadTx.merchant ?? merchantLabel,
        account: payloadTx.account ?? accountLabel,
        to_account: payloadTx.to_account ?? toAccountLabel,
        receipts: receiptsPayload,
      });
    } else if (useCloud && sessionUser) {
      try {
        const saved = await apiAdd({
          date: payloadTx.date,
          type: payloadTx.type,
          amount: payloadTx.amount,
          notes: resolvedNote,
          title: payloadTx.title ?? null,
          category_id: categoryId || null,
          account_id: payloadTx.account_id || null,
          to_account_id: payloadTx.type === "transfer" ? payloadTx.to_account_id || null : null,
          merchant_id: payloadTx.merchant_id || null,
          receipts: receiptsPayload,
        });
        const resolvedCategory =
          baseCategoryName ??
          saved.category ??
          categoryNameById(saved.category_id) ??
          null;
        if (resolvedCategory && saved.category_id && !catMap[resolvedCategory]) {
          setCatMap((prev) => ({ ...prev, [resolvedCategory]: saved.category_id }));
        }
        finalRecord = pushRecord({
          ...saved,
          category: resolvedCategory,
          note: saved.note ?? resolvedNote,
          merchant: saved.merchant ?? merchantLabel,
          account: saved.account ?? accountLabel,
          to_account: saved.to_account ?? toAccountLabel,
        });
      } catch (e) {
        alert("Gagal menambah transaksi: " + e.message);
        return;
      }
    } else {
      finalRecord = pushRecord({
        ...payloadTx,
        id: uid(),
        category: baseCategoryName,
        category_id: categoryId,
        note: resolvedNote,
        merchant: merchantLabel,
        account: accountLabel,
        to_account: toAccountLabel,
        receipts: receiptsPayload,
      });
    }

    if (categoryId && baseCategoryName && !catMap[baseCategoryName]) {
      setCatMap((prev) => ({ ...prev, [baseCategoryName]: categoryId }));
    }

    if (prefs.walletSound) playChaChing();
    triggerMoneyTalk(finalRecord || payloadTx);
  };

  const updateTx = async (id, patch) => {
    if (useCloud && sessionUser) {
      try {
        const payload = { ...patch };
        if (payload.category && catMap[payload.category]) {
          payload.category_id = catMap[payload.category];
        }
        if ("category_id" in payload) {
          payload.category_id = payload.category_id || null;
        }
        if ("account_id" in payload) {
          payload.account_id = payload.account_id || null;
        }
        if ("merchant_id" in payload) {
          payload.merchant_id = payload.merchant_id || null;
        }
        if ("parent_id" in payload) {
          payload.parent_id = payload.parent_id || null;
        }
        if ("transfer_group_id" in payload) {
          payload.transfer_group_id =
            payload.type === "transfer" ? payload.transfer_group_id || null : null;
        }
        if ("to_account_id" in payload) {
          payload.to_account_id =
            payload.type === "transfer" ? payload.to_account_id || null : null;
        }
        const saved = await apiUpdate(id, payload);
        const res = { ...saved, category: saved.category };
        setData((d) => ({
          ...d,
          txs: d.txs.map((t) => (t.id === id ? res : t)),
        }));
      } catch (e) {
        alert("Gagal mengupdate transaksi: " + e.message);
      }
    } else {
      setData((d) => ({
        ...d,
        txs: d.txs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
    }
  };

  const removeTx = async (id) => {
    if (useCloud && sessionUser) {
      try {
        await apiDelete(id);
        setData((d) => ({ ...d, txs: d.txs.filter((t) => t.id !== id) }));
      } catch (e) {
        alert("Gagal menghapus transaksi: " + e.message);
      }
    } else {
      setData((d) => ({ ...d, txs: d.txs.filter((t) => t.id !== id) }));
    }
  };

  const saveCategories = async (payload) => {
    setData((d) => ({ ...d, cat: payload }));
    if (useCloud && sessionUser) {
      try {
        const rows = await upsertCategories(payload);
        const map = {};
        rows.forEach((r) => (map[r.name] = r.id));
        setCatMap(map);
      } catch (e) {
        alert("Gagal menyimpan kategori: " + e.message);
      }
    }
  };

  useEffect(() => {
    const subs = loadSubscriptions();
    const upcoming = findUpcoming(subs);
    upcoming.forEach(({ sub, days }) => {
      if (days === 7) {
        addToast(`Langganan ${sub.name} jatuh tempo dalam 7 hari`);
      } else if (days === 1) {
        addToast(`Langganan ${sub.name} jatuh tempo besok`);
      } else if (days === 0) {
        addToast(`Langganan ${sub.name} jatuh tempo hari ini`);
        if (sub.autoDraft) {
          const ok = window.confirm(`Buat transaksi untuk ${sub.name}?`);
          if (ok) {
            addTx({
              date: new Date().toISOString().slice(0, 10),
              type: "expense",
              category: sub.category,
              amount: sub.amount,
              note: sub.note || "",
            });
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTx]);

  const months = useMemo(() => {
    const set = new Set(data.txs.map((t) => String(t.date).slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [data.txs]);

  const allCategories = useMemo(
    () => [...data.cat.income, ...data.cat.expense],
    [data.cat]
  );

  const filtered = useMemo(() => {
    let res = data.txs.filter((t) => {
      if (filter.type !== "all" && t.type !== filter.type) return false;
      if (filter.month !== "all" && String(t.date).slice(0, 7) !== filter.month)
        return false;
      if (filter.category !== "all" && t.category !== filter.category)
        return false;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        const note = t.note?.toLowerCase() || "";
        const cat = t.category?.toLowerCase() || "";
        if (!note.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });

    res.sort((a, b) => {
      if (filter.sort === "amount-desc")
        return Number(b.amount) - Number(a.amount);
      if (filter.sort === "amount-asc")
        return Number(a.amount) - Number(b.amount);
      if (filter.sort === "date-asc")
        return new Date(a.date) - new Date(b.date);
      // default date-desc
      return new Date(b.date) - new Date(a.date);
    });

    return res;
  }, [data.txs, filter]);

  const stats = useMemo(() => {
    const income = filtered
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = filtered
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    return { income, expense, balance: income - expense };
  }, [filtered]);

  return (
    <CategoryProvider catMeta={catMeta}>
      <BootGate>
        <>
          <Routes>
            <Route path="/auth" element={<AuthLogin />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route element={<AuthGuard />}>
              <Route
                path="/"
                element={
                  <ProtectedAppContainer
                    layoutState={layoutState}
                    sessionUser={sessionUser}
                  />
                }
              >
                <Route
                  index
                  element={
                    <Dashboard
                      stats={stats}
                      monthForReport={
                        filter.month === "all" ? currentMonth : filter.month
                      }
                      txs={data.txs}
                      budgets={data.budgets}
                      budgetStatus={data.budgetStatus}
                      months={months}
                      challenges={challenges}
                      prefs={prefs}
                    />
                  }
                />
                <Route
                  path="transactions"
                  element={
                    <Transactions
                      months={months}
                      categories={allCategories}
                      filter={filter}
                      setFilter={setFilter}
                      items={filtered}
                      onRemove={removeTx}
                      onUpdate={updateTx}
                    />
                  }
                />
                <Route
                  path="budgets"
                  element={<Budgets currentMonth={currentMonth} />}
                />
                <Route path="debts" element={<DebtsPage />} />
                <Route path="goals" element={<GoalsPage />} />
                <Route
                  path="challenges"
                  element={
                    <ChallengesPage
                      challenges={challenges}
                      onAdd={addChallenge}
                      onUpdate={updateChallenge}
                      onRemove={removeChallenge}
                      txs={data.txs}
                    />
                  }
                />
                <Route
                  path="categories"
                  element={<Categories cat={data.cat} onSave={saveCategories} />}
                />
                <Route path="accounts" element={<AccountsPage />} />
                <Route
                  path="subscriptions"
                  element={<Subscriptions categories={data.cat} />}
                />
                <Route path="data" element={<DataPage />} />
                <Route
                  path="import"
                  element={
                    <ImportWizard
                      txs={data.txs}
                      onAdd={addTx}
                      categories={data.cat}
                      rules={rules}
                      setRules={setRules}
                      onCancel={() => navigate("/data")}
                    />
                  }
                />
                <Route
                  path="transaction/add"
                  element={<TransactionAdd onAdd={addTx} />}
                />
                <Route
                  path="add"
                  element={<Navigate to="/transaction/add" replace />}
                />
                <Route path="settings" element={<SettingsPage />} />
                <Route
                  path="admin"
                  element={
                    <AdminGuard>
                      <AdminPage />
                    </AdminGuard>
                  }
                />
                <Route
                  path="profile"
                  element={<ProfilePage transactions={data.txs} challenges={challenges} />}
                />
                <Route path="dashboard" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
          <SettingsPanel
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            value={{ theme, ...prefs }}
            onChange={(val) => {
              const {
                theme: nextTheme,
                density,
                defaultMonth,
                currency,
                accent,
                walletSound = false,
                walletSensitivity = "default",
                walletShowTips = true,
                lateMode = "auto",
                lateModeDay = 24,
                lateModeBalance = 0.4,
                moneyTalkEnabled = true,
                moneyTalkIntensity = "normal",
                moneyTalkLang = "id",
              } = val;
              setTheme(nextTheme);
              setPrefs({
                density,
                defaultMonth,
                currency,
                accent,
                walletSound,
                walletSensitivity,
                walletShowTips,
                lateMode,
                lateModeDay,
                lateModeBalance,
                moneyTalkEnabled,
                moneyTalkIntensity,
                moneyTalkLang,
              });
            }}
          />
        </>
      </BootGate>
    </CategoryProvider>
  );
}

function AppContent({ layoutState }) {
  const [prefs, setPrefs] = useState(() => {
    const raw = localStorage.getItem("hematwoi:v3:prefs");
    const base = {
      density: "comfortable",
      defaultMonth: "current",
      currency: "IDR",
      accent: "blue",
      walletSound: false,
      walletSensitivity: "default",
      walletShowTips: true,
      lateMode: "auto",
      lateModeDay: 24,
      lateModeBalance: 0.4,
      moneyTalkEnabled: true,
      moneyTalkIntensity: "normal",
      moneyTalkLang: "id",
    };
    if (!raw) return base;
    try {
      return { ...base, ...JSON.parse(raw) };
    } catch {
      return base;
    }
  });
  return (
    <MoneyTalkProvider prefs={prefs}>
      <AppShell prefs={prefs} setPrefs={setPrefs} layoutState={layoutState} />
    </MoneyTalkProvider>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMini, setSidebarMini] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  const layoutState = useMemo(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      sidebarMini,
      setSidebarMini,
      profileOpen,
      setProfileOpen,
    }),
    [
      profileOpen,
      setProfileOpen,
      sidebarMini,
      setSidebarMini,
      sidebarOpen,
      setSidebarOpen,
    ]
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSidebarOpen]);

  return (
    <ModeProvider>
      <UserProfileProvider>
        <ToastProvider>
          <DataProvider>
            <AppContent layoutState={layoutState} />
          </DataProvider>
        </ToastProvider>
      </UserProfileProvider>
    </ModeProvider>
  );
}
