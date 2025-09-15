import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";

import TopBar from "./components/TopBar";
import SettingsPanel from "./components/SettingsPanel";

import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Categories from "./pages/Categories";
import DataToolsPage from "./pages/DataToolsPage";
import AddWizard from "./pages/AddWizard";
import Subscriptions from "./pages/Subscriptions";
import ImportWizard from "./pages/ImportWizard";
import GoalsPage from "./pages/Goals";

import { supabase } from "./lib/supabase";
import {
  listTransactions,
  addTransaction as apiAdd,
  updateTransaction as apiUpdate,
  deleteTransaction as apiDelete,
  upsertCategories,
} from "./lib/api";

import CategoryProvider from "./context/CategoryContext";
import ToastProvider, { useToast } from "./context/ToastContext";
import UserProfileProvider from "./context/UserProfileContext.jsx";
import { loadSubscriptions, findUpcoming } from "./lib/subscriptions";
import { allocateIncome } from "./lib/goals";


const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const defaultCategories = {
  income: ["Gaji", "Bonus", "Lainnya"],
  expense: [
    "Makan",
    "Transport",
    "Belanja",
    "Tagihan",
    "Kesehatan",
    "Hiburan",
    "Lainnya",
  ],
};

const ACCENTS = {
  blue: "#3898f8",
  emerald: "#10b981",
  violet: "#8b5cf6",
  amber: "#f59e0b",
};

function loadInitial() {
  try {
    const raw = localStorage.getItem("hematwoi:v3");
    if (!raw)
      return { txs: [], cat: defaultCategories, budgets: [], goals: [], envelopes: [] };
    const parsed = JSON.parse(raw);
    return {
      txs: parsed.txs || [],
      cat: parsed.cat || defaultCategories,
      budgets: parsed.budgets || [],
      goals: parsed.goals || [],
      envelopes: parsed.envelopes || [],
    };
  } catch {
    return { txs: [], cat: defaultCategories, budgets: [], goals: [], envelopes: [] };
  }
}

function AppContent() {
  const [data, setData] = useState(loadInitial);
  const [filter, setFilter] = useState({
    type: "all",
    q: "",
    month: "all",
    category: "all",
    sort: "date-desc",
  });
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("hematwoi:v3:theme") || "system"
  );
  const [prefs, setPrefs] = useState(() => {
    const raw = localStorage.getItem("hematwoi:v3:prefs");
    const base = {
      density: "comfortable",
      defaultMonth: "current",
      currency: "IDR",
      accent: "blue",
    };
    if (!raw) return base;
    try {
      return { ...base, ...JSON.parse(raw) };
    } catch {
      return base;
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [useCloud, setUseCloud] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [catMeta, setCatMeta] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hematwoi:v3:catMeta")) || {};
    } catch {
      return {};
    }
  });
  const [catMap, setCatMap] = useState({});
  const [rules, setRules] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hematwoi:v3:rules")) || {};
    } catch {
      return {};
    }
  });
  const [allocRules, setAllocRules] = useState(() => {
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
  window.__hw_prefs = prefs;

  const navigate = useNavigate();
  const location = useLocation();
  const hideNav = location.pathname.startsWith("/add");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSessionUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUser && useCloud) setUseCloud(false);
  }, [sessionUser, useCloud]);

  useEffect(() => {
    const root = document.documentElement;
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && sysDark);
    root.classList.toggle("dark", isDark);
    localStorage.setItem("hematwoi:v3:theme", theme);
  }, [theme]);

  useEffect(() => {
    const color = ACCENTS[prefs.accent] || ACCENTS.blue;
    document.documentElement.style.setProperty("--brand", color);
  }, [prefs.accent]);

  useEffect(() => {
    localStorage.setItem("hematwoi:v3:prefs", JSON.stringify(prefs));
    window.__hw_prefs = prefs;
  }, [prefs]);

  useEffect(() => {
    async function loadProfile() {
      if (!useCloud || !sessionUser) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", sessionUser.id)
        .single();
      if (!error && data?.preferences) {
        const p = data.preferences || {};
        if (p.theme) setTheme(p.theme);
        setPrefs((prev) => ({ ...prev, ...p }));
      }
    }
    loadProfile();
  }, [useCloud, sessionUser]);

  useEffect(() => {
    async function saveProfile() {
      if (!useCloud || !sessionUser) return;
      const preferences = { ...prefs, theme };
      await supabase
        .from("profiles")
        .upsert({ id: sessionUser.id, preferences })
        .select("id")
        .single();
    }
    saveProfile();
  }, [theme, prefs, useCloud, sessionUser]);

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
  }, [useCloud, sessionUser]);

  async function fetchCategoriesCloud() {
    try {
      const { data: rows, error } = await supabase
        .from("categories")
        .select("id,type,name,color,sort_order");
      if (error) throw error;
      const map = {};
      const meta = {};
      const incomeRows = [];
      const expenseRows = [];
      (rows || []).forEach((r) => {
        map[r.name] = r.id;
        meta[r.name] = {
          color: r.color || "#64748b",
          type: r.type,
          sort: r.sort_order ?? 0,
        };
        if (r.type === "income") incomeRows.push(r);
        else if (r.type === "expense") expenseRows.push(r);
      });
      incomeRows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      expenseRows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
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
  }

  async function fetchTxsCloud() {
    try {
      const res = await listTransactions({ pageSize: 1000 });
      setData((d) => ({ ...d, txs: res.rows || [] }));
    } catch (e) {
      console.error("fetch transactions failed", e);
    }
  }

  async function fetchBudgetsCloud() {
    try {
      const { data: rows, error } = await supabase
        .from("budgets")
        .select("id,category,month,amount")
        .order("month", { ascending: false });
      if (error) throw error;
      setData((d) => ({ ...d, budgets: rows || [] }));
    } catch (e) {
      console.error("fetch budgets failed", e);
    }
  }

  const addTx = async (tx) => {
    if (useCloud && sessionUser) {
      try {
        const saved = await apiAdd({
          date: tx.date,
          type: tx.type,
          amount: tx.amount,
          note: tx.note,
          category_id: catMap[tx.category] || null,
        });
        const res = { ...saved, category: tx.category };
        setData((d) => {
          let goals = d.goals;
          let envelopes = d.envelopes;
          if (tx.type === "income") {
            const alloc = allocateIncome(tx.amount, d.goals, d.envelopes, allocRules);
            goals = alloc.goals;
            envelopes = alloc.envelopes;
          }
          return { ...d, txs: [res, ...d.txs], goals, envelopes };
        });
      } catch (e) {
        alert("Gagal menambah transaksi: " + e.message);
      }
    } else {
      setData((d) => {
        let goals = d.goals;
        let envelopes = d.envelopes;
        if (tx.type === "income") {
          const alloc = allocateIncome(tx.amount, d.goals, d.envelopes, allocRules);
          goals = alloc.goals;
          envelopes = alloc.envelopes;
        }
        return {
          ...d,
          txs: [{ ...tx, id: uid() }, ...d.txs],
          goals,
          envelopes,
        };
      });
    }
  };

  const addGoal = (goal) => {
    setData((d) => ({ ...d, goals: [...(d.goals || []), goal] }));
  };

  const addEnvelope = (env) => {
    setData((d) => ({ ...d, envelopes: [...(d.envelopes || []), env] }));
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
    if (data.budgets.some((b) => b.category === category && b.month === m)) return;

    if (useCloud && sessionUser) {
      try {
        const { data: row, error } = await supabase
          .from("budgets")
          .insert({ user_id: sessionUser.id, category, month: m, amount })
          .select("id,category,month,amount")
          .single();
        if (error) throw error;
        setData((d) => ({ ...d, budgets: [...d.budgets, row] }));
      } catch (e) {
        alert("Gagal menambah budget: " + e.message);
      }
    } else {
      setData((d) => ({
        ...d,
        budgets: [...d.budgets, { id: uid(), category, month: m, amount }],
      }));
    }
  };

  const removeBudget = async (id) => {
    if (useCloud && sessionUser) {
      try {
        await supabase.from("budgets").delete().eq("id", id);
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
          const ok = window.confirm(
            `Buat transaksi untuk ${sub.name}?`
          );
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
        setData((d) => ({ ...d, txs: [...txs, ...d.txs] }));
      }
    };
    reader.readAsText(file);
  }

  return (
    <CategoryProvider catMeta={catMeta}>
      <TopBar stats={stats} useCloud={useCloud} setUseCloud={setUseCloud} />
      {!hideNav && (
        <nav className="max-w-5xl mx-auto px-4">
          <ul className="flex gap-3 overflow-auto">
            <li>
              <Link
                to="/"
                className={`px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  location.pathname === "/" ? "text-brand border-b-2 border-brand" : ""
                }`}
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/transactions"
                className={`px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  location.pathname === "/transactions"
                    ? "text-brand border-b-2 border-brand"
                    : ""
                }`}
              >
                Transaksi
              </Link>
            </li>
            <li>
              <Link
                to="/budgets"
                className={`px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  location.pathname === "/budgets" ? "text-brand border-b-2 border-brand" : ""
                }`}
              >
                Anggaran
              </Link>
            </li>
            <li>
              <Link
                to="/goals"
                className={`px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  location.pathname === "/goals" ? "text-brand border-b-2 border-brand" : ""
                }`}
              >
                Goals
              </Link>
            </li>
            <li>
              <Link
                to="/categories"
                className={`px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  location.pathname === "/categories"
                    ? "text-brand border-b-2 border-brand"
                    : ""
                }`}
              >
                Kategori
              </Link>
            </li>
            <li>
              <Link
                to="/data"
                className={`px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  location.pathname === "/data" ? "text-brand border-b-2 border-brand" : ""
                }`}
              >
                Data
              </Link>
            </li>
            <li>
              <Link
                to="/subscriptions"
                className={`px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  location.pathname === "/subscriptions" ? "text-brand border-b-2 border-brand" : ""
                }`}
              >
                Langganan
              </Link>
            </li>
          </ul>
        </nav>
      )}
      <main id="main" tabIndex="-1" className="focus:outline-none">
        <Routes>
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
          <Route
            path="/goals"
            element={
              <GoalsPage
                goals={data.goals}
                envelopes={data.envelopes}
                rules={allocRules}
                onAddGoal={addGoal}
                onAddEnvelope={addEnvelope}
                onSaveRules={setAllocRules}
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
            path="/add"
            element={
              <AddWizard
                categories={data.cat}
                onAdd={addTx}
                onCancel={() => navigate("/")}
              />
            }
          />
        </Routes>
      </main>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        value={{ theme, ...prefs }}
        onChange={(val) => {
          const { theme: nextTheme, density, defaultMonth, currency, accent } = val;
          setTheme(nextTheme);
          setPrefs({ density, defaultMonth, currency, accent });
        }}
      />
    </CategoryProvider>
  );
}

export default function App() {
  return (
    <UserProfileProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </UserProfileProvider>
  );
}
