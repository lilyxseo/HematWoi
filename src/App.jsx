import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import Sidebar from "./layout/Sidebar";
import SettingsPanel from "./components/SettingsPanel";
import SyncBanner from "./components/SyncBanner";

import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Categories from "./pages/Categories";
import DataToolsPage from "./pages/DataToolsPage";
import TransactionAdd from "./pages/TransactionAdd";
import Subscriptions from "./pages/Subscriptions";
import ImportWizard from "./pages/ImportWizard";
import GoalsPage from "./pages/Goals";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/Profile";
import AuthPage from "./pages/Auth";
import ChallengesPage from "./pages/Challenges.jsx";
import useChallenges from "./hooks/useChallenges.js";
import AuthGuard from "./components/AuthGuard";
import { DataProvider } from "./context/DataContext";

import { supabase } from "./lib/supabase";
import { playChaChing } from "./lib/walletSound";
import {
  listTransactions,
  addTransaction as apiAdd,
  updateTransaction as apiUpdate,
  deleteTransaction as apiDelete,
  upsertCategories,
  listCategories as apiListCategories,
} from "./lib/api";

import CategoryProvider from "./context/CategoryContext";
import ToastProvider, { useToast } from "./context/ToastContext";
import UserProfileProvider from "./context/UserProfileContext.jsx";
import { loadSubscriptions, findUpcoming } from "./lib/subscriptions";
import { allocateIncome } from "./lib/goals";
import MoneyTalkProvider, {
  useMoneyTalk,
} from "./context/MoneyTalkContext.jsx";
import { ModeProvider, useMode } from "./hooks/useMode";

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
      };
    const parsed = JSON.parse(raw);
    return {
      txs: parsed.txs || [],
      cat: parsed.cat || defaultCategories,
      budgets: parsed.budgets || [],
      goals: parsed.goals || [],
      envelopes: parsed.envelopes || [],
    };
  } catch {
    return {
      txs: [],
      cat: defaultCategories,
      budgets: [],
      goals: [],
      envelopes: [],
    };
  }
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
  const location = useLocation();
  const hideNav = location.pathname.startsWith("/add");

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
      .getUser()
      .then(({ data }) => {
        if (!isMounted) return;
        setSessionUser(data.user ?? null);
        setSessionChecked(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setSessionUser(null);
        setSessionChecked(true);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (!isMounted) return;
      setSessionUser(session?.user ?? null);
      setSessionChecked(true);
    });
    return () => {
      isMounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

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
    const root = document.documentElement;
    root.style.setProperty('--brand-h', brand.h);
    root.style.setProperty('--brand-s', brand.s + '%');
    root.style.setProperty('--brand-l', brand.l + '%');
    root.style.setProperty(
      '--brand-foreground',
      brand.l > 50 ? '#000000' : '#ffffff'
    );
    root.style.setProperty(
      '--brand-soft',
      `hsl(${brand.h} ${brand.s}% ${Math.min(95, brand.l + 40)}%)`
    );
    root.style.setProperty(
      '--brand-ring',
      `hsl(${brand.h} ${brand.s}% ${Math.max(0, brand.l - 20)}%)`
    );
  }, [brand]);

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

  useEffect(() => {
    if (useCloud && sessionUser) {
      fetchCategoriesCloud();
      fetchTxsCloud();
      fetchBudgetsCloud();
    }
  }, [useCloud, sessionUser, fetchCategoriesCloud, fetchTxsCloud, fetchBudgetsCloud]);

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
        .select(
          "id, month, amount_planned, amount, carryover_enabled, carryover, notes, note, category_id"
        )
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
      const mapped = (rows || []).map((row) => {
        const planned = Number(row?.amount_planned ?? row?.amount ?? 0);
        const categoryLabel =
          (row?.category_id &&
            (categoryNameById(row.category_id) ||
              categoriesById[row.category_id])) ||
          row?.category ||
          row?.category_name ||
          "Tanpa kategori";
        return {
          id: row.id,
          category_id: row.category_id,
          category: categoryLabel,
          month: row?.month ? String(row.month).slice(0, 7) : null,
          amount: planned,
          amount_planned: planned,
          carryover_enabled: row?.carryover_enabled ?? row?.carryover ?? false,
          notes: row?.notes ?? row?.note ?? null,
        };
      });
      setData((d) => ({ ...d, budgets: mapped }));
    } catch (e) {
      console.error("fetch budgets failed", e);
    }
  }, [sessionUser, categoryNameById]);

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
    const isOverBudget = budget ? spent > Number(budget.amount || 0) : false;
    speak({
      category,
      amount,
      context: { isHigh, isSavings, isOverBudget },
    });
  };

  const addTx = async (tx) => {
    const categoryId = tx.category_id ?? (tx.category ? catMap[tx.category] ?? null : null);
    const resolvedNote = tx.notes ?? tx.note ?? "";
    const tagsPayload = Array.isArray(tx.tag_ids)
      ? tx.tag_ids.filter(Boolean)
      : Array.isArray(tx.tags)
      ? tx.tags.filter(Boolean)
      : [];
    const displayTags =
      Array.isArray(tx.tag_labels) && tx.tag_labels.length
        ? tx.tag_labels
        : Array.isArray(tx.tagNames)
        ? tx.tagNames
        : [];
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

    let finalRecord = null;

    if (useCloud && sessionUser) {
      try {
        const saved = await apiAdd({
          date: tx.date,
          type: tx.type,
          amount: tx.amount,
          notes: resolvedNote,
          title: tx.title ?? null,
          category_id: categoryId,
          account_id: tx.account_id ?? null,
          to_account_id: tx.type === "transfer" ? tx.to_account_id ?? null : null,
          merchant_id: tx.merchant_id ?? null,
          tags: tagsPayload,
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
          tags: saved.tags?.length ? saved.tags : displayTags,
          tag_ids: saved.tag_ids?.length ? saved.tag_ids : tagsPayload,
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
        tags: displayTags,
        tag_ids: tagsPayload,
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

  const addBudget = async ({ category, month, amount }) => {
    if (!data.cat.expense.includes(category)) return;
    const m = String(month).slice(0, 7);
    const categoryId = catMap[category] ?? null;
    if (useCloud && sessionUser && !categoryId) return;
    if (data.budgets.some((b) => b.category === category && b.month === m))
      return;

    if (useCloud && sessionUser) {
      try {
        const { data: row, error } = await supabase
          .from("budgets")
          .insert({
            user_id: sessionUser.id,
            category_id: categoryId,
            month: `${m}-01`,
            amount_planned: amount,
          })
          .select(
            "id, month, amount_planned, amount, carryover_enabled, carryover, notes, note, category_id"
          )
          .single();
        if (error) throw error;
        const planned = Number(row?.amount_planned ?? row?.amount ?? amount);
        const categoryLabel =
          (row?.category_id && categoryNameById(row.category_id)) ||
          category ||
          row?.category ||
          row?.category_name ||
          "Tanpa kategori";
        const mapped = {
          id: row.id,
          category_id: row.category_id,
          category: categoryLabel,
          month: row?.month ? String(row.month).slice(0, 7) : m,
          amount: planned,
          amount_planned: planned,
          carryover_enabled: row?.carryover_enabled ?? row?.carryover ?? false,
          notes: row?.notes ?? row?.note ?? null,
        };
        setData((d) => ({ ...d, budgets: [...d.budgets, mapped] }));
      } catch (e) {
        alert("Gagal menambah budget: " + e.message);
      }
    } else {
      setData((d) => ({
        ...d,
        budgets: [
          ...d.budgets,
          {
            id: uid(),
            category,
            category_id: categoryId,
            month: m,
            amount,
            amount_planned: amount,
          },
        ],
      }));
    }
  };

  const removeBudget = async (id) => {
    if (useCloud && sessionUser) {
      try {
        await supabase
          .from("budgets")
          .delete()
          .eq("id", id)
          .eq("user_id", sessionUser.id);
      } catch (e) {
        alert("Gagal menghapus budget: " + e.message);
        return;
      }
    }
    setData((d) => ({ ...d, budgets: d.budgets.filter((b) => b.id !== id) }));
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

  function handleExport() {
    const payload = { txs: data.txs, cat: data.cat, budgets: data.budgets };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hematwoi-data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function handleImportJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (
          typeof parsed !== "object" ||
          !parsed ||
          !("txs" in parsed) ||
          !("cat" in parsed) ||
          !("budgets" in parsed)
        ) {
          throw new Error("invalid");
        }
        setData((d) => ({
          txs: Array.isArray(parsed.txs) ? [...parsed.txs, ...d.txs] : d.txs,
          cat: parsed.cat || d.cat,
          budgets: Array.isArray(parsed.budgets)
            ? [...parsed.budgets, ...d.budgets]
            : d.budgets,
        }));
      } catch {
        alert("File JSON tidak valid");
      }
    };
    reader.readAsText(file);
  }

  function handleImportCSV(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const txt = String(e.target.result || "");
      const lines = txt
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.length) return;

      let start = 0;
      const header = lines[0].toLowerCase();
      if (
        header.includes("date") &&
        header.includes("type") &&
        header.includes("category")
      ) {
        start = 1;
      }

      const txs = [];
      for (let i = start; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        if (cols.length < 5) continue;
        const [date, type, category, note, amountStr] = cols;
        if (!date || !type || !category || amountStr == null) continue;
        const amount = Number(amountStr);
        if (Number.isNaN(amount)) continue;
        txs.push({ id: uid(), date, type, category, note, amount });
      }

      if (txs.length) {
        txs.forEach(triggerMoneyTalk);
        setData((d) => ({ ...d, txs: [...txs, ...d.txs] }));
      }
    };
    reader.readAsText(file);
  }

  return (
    <CategoryProvider catMeta={catMeta}>
      {!hideNav && (
        <Sidebar
          theme={theme}
          setTheme={setTheme}
          brand={brand}
          setBrand={setBrand}
        />
      )}
      <div
        className={`min-h-[100dvh] flex flex-col overflow-x-hidden ${!hideNav ? 'md:ml-[var(--sidebar-width)]' : ''}`}
      >
        <SyncBanner />
        <main
          id="main"
          tabIndex="-1"
          className="flex-1 overflow-y-auto focus:outline-none"
        >
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route element={<AuthGuard />}>
              <Route
              path="/"
              element={
                <Dashboard
                  stats={stats}
                  monthForReport={
                    filter.month === "all" ? currentMonth : filter.month
                  }
                  txs={data.txs}
                  budgets={data.budgets}
                  months={months}
                  challenges={challenges}
                  prefs={prefs}
                />
              }
            />
            <Route
              path="/transactions"
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
              path="/budgets"
              element={
                <Budgets
                  currentMonth={currentMonth}
                  data={data}
                  onAdd={addBudget}
                  onRemove={removeBudget}
                />
              }
            />
            <Route path="/goals" element={<GoalsPage />} />
            <Route
              path="/challenges"
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
              path="/categories"
              element={<Categories cat={data.cat} onSave={saveCategories} />}
            />
            <Route
              path="/subscriptions"
              element={<Subscriptions categories={data.cat} />}
            />
            <Route
              path="/data"
              element={
                <DataToolsPage
                  onExport={handleExport}
                  onImportJSON={handleImportJSON}
                  onImportCSV={handleImportCSV}
                />
              }
            />
            <Route
              path="/import"
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
              path="/transaction/add"
              element={<TransactionAdd onAdd={addTx} />}
            />
            <Route path="/add" element={<Navigate to="/transaction/add" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/profile"
              element={<ProfilePage transactions={data.txs} challenges={challenges} />}
            />
          </Route>
          </Routes>
        </main>
      </div>
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
