import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";

import AppSidebar from "./layout/AppSidebar";
import MainLayout from "./layout/MainLayout";
import SettingsPanel from "./components/SettingsPanel";
import DailyDigest from "./components/DailyDigest";
import SyncBanner from "./components/SyncBanner";
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
import useDailyDigest from "./hooks/useDailyDigest";

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

function DailyDigestLayer({ transactions }) {
  const digest = useDailyDigest({ transactions });

  if (!digest.open || !digest.data || !digest.userId) {
    return null;
  }

  return (
    <DailyDigest
      open={digest.open}
      data={digest.data}
      variant={digest.variant}
      onClose={digest.close}
    />
  );
}

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

function ProtectedAppContainer({ theme, setTheme, brand, setBrand }) {
  const location = useLocation();
  const hideNav = location.pathname.startsWith("/add");

  return (
    <MainLayout
      hideSidebar={hideNav}
      sidebar={
        !hideNav ? (
          <AppSidebar
            theme={theme}
            setTheme={setTheme}
            brand={brand}
            setBrand={setBrand}
          />
        ) : null
      }
    >
      <div className="flex min-h-full flex-col">
        <SyncBanner />
        <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <Outlet />
        </div>
      </div>
    </MainLayout>
  );
}

function AppShell({ prefs, setPrefs }) {
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
    const categoryId = tx.category_id ?? (tx.category ? catMap[tx.category] ?? null : null);
    const resolvedNote = tx.notes ?? tx.note ?? "";
    const receiptsPayload = Array.isArray(tx.receipts) ? tx.receipts : [];
    const merchantLabel = tx.merchant_name ?? tx.merchant ?? null;
    const accountLabel = tx.account_name ?? tx.account ?? null;
    const toAccountLabel = tx.to_account_name ?? tx.to_account ?? null;
    const baseCategoryName = tx.category ?? tx.category_name ?? categoryNameById(categoryId);

    const pushRecord = (record) => {
      const normalized = {
        ...record,
        amount: Number(record.amount ?? tx.amount ?? 0),
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

    if (tx?.__persisted) {
      const normalized = pushRecord({
        ...tx,
        category: baseCategoryName,
        category_id: categoryId,
        note: resolvedNote,
        merchant: merchantLabel,
        account: accountLabel,
        to_account: toAccountLabel,
        receipts: receiptsPayload,
      });
      if (categoryId && baseCategoryName && !catMap[baseCategoryName]) {
        setCatMap((prev) => ({ ...prev, [baseCategoryName]: categoryId }));
      }
      if (prefs.walletSound) playChaChing();
      triggerMoneyTalk(normalized);
      return normalized;
    }

    let finalRecord = null;

    if (useCloud && sessionUser) {
      try {
        const saved = await apiAdd({
          date: tx.date,
          type: tx.type,
          amount: tx.amount,
          notes: resolvedNote,
          title: tx.title ?? null,
          category_id: categoryId || null,
          account_id: tx.account_id || null,
          to_account_id: tx.type === "transfer" ? tx.to_account_id || null : null,
          merchant_id: tx.merchant_id || null,
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
        ...tx,
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
    triggerMoneyTalk(finalRecord || tx);
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
          <DailyDigestLayer transactions={data.txs} />
          <Routes>
            <Route path="/auth" element={<AuthLogin />} />
            <Route element={<AuthGuard />}>
              <Route
                path="/"
                element={
                  <ProtectedAppContainer
                    theme={theme}
                    setTheme={setTheme}
                    brand={brand}
                    setBrand={setBrand}
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

function AppContent() {
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
      <AppShell prefs={prefs} setPrefs={setPrefs} />
    </MoneyTalkProvider>
  );
}

export default function App() {
  return (
    <ModeProvider>
      <UserProfileProvider>
        <ToastProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </ToastProvider>
      </UserProfileProvider>
    </ModeProvider>
  );
}
