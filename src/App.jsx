import { useEffect, useMemo, useState, useRef } from "react";
import TopBar from "./components/TopBar";
import AddForm from "./components/AddForm";
import Filters from "./components/Filters";
import Summary from "./components/Summary";
import DataTools from "./components/DataTools";
import TxTable from "./components/TxTable";
import BudgetSection from "./components/BudgetSection";
import Modal from "./components/Modal";
import ManageCategories from "./components/ManageCategories";
import DashboardCharts from "./components/DashboardCharts";
import ReportFilters from "./components/ReportFilters";
import Reports from "./components/Reports";
import Skeleton from "./components/Skeleton";
import { Table as TableIcon } from "lucide-react";
import { supabase } from "./lib/supabase";
import {
  listTransactions,
  addTransaction as apiAdd,
  updateTransaction as apiUpdate,
  deleteTransaction as apiDelete,
  upsertCategories,
} from "./lib/api";
import CategoryProvider from "./context/CategoryContext";

import SettingsPanel from "./components/SettingsPanel";

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

function loadInitial() {
  try {
    const raw = localStorage.getItem("hematwoi:v3");
    if (!raw) return { txs: [], cat: defaultCategories, budgets: [] };
    const parsed = JSON.parse(raw);
    return {
      txs: parsed.txs || [],
      cat: parsed.cat || defaultCategories,
      budgets: parsed.budgets || [],
    };
  } catch {
    return { txs: [], cat: defaultCategories, budgets: [] };
  }
}

export default function App() {
  const [data, setData] = useState(loadInitial);
  const [filter, setFilter] = useState({ type: "all", q: "", month: "all" });
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [reportMonth, setReportMonth] = useState(filter.month === "all" ? currentMonth : filter.month);
  const [comparePrev, setComparePrev] = useState(false);
  const [showCat, setShowCat] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('hematwoi:v3:theme') || 'system');
  const [prefs, setPrefs] = useState(() => {
    const raw = localStorage.getItem('hematwoi:v3:prefs');
    return raw ? JSON.parse(raw) : { density: 'comfortable', defaultMonth: 'current', currency: 'IDR' };
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
  const [catMap, setCatMap] = useState({}); // name -> id (cloud)
  window.__hw_prefs = prefs;

  const addRef = useRef(null);

  // Supabase auth
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
    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && sysDark);
    root.classList.toggle('dark', isDark);
    localStorage.setItem('hematwoi:v3:theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('hematwoi:v3:prefs', JSON.stringify(prefs));
    window.__hw_prefs = prefs;
  }, [prefs]);



  useEffect(() => {
    async function loadProfile() {
      if (!useCloud || !sessionUser) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', sessionUser.id)
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
        .from('profiles')
        .upsert({ id: sessionUser.id, preferences })
        .select('id')
        .single();
    }
    saveProfile();
  }, [theme, prefs, useCloud, sessionUser]);

  useEffect(() => {
    const applied = sessionStorage.getItem('hw:applied-default-month');
    if (applied) return;
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 7);
    if (prefs.defaultMonth === 'current')
      setFilter((f) => ({ ...f, month: currentMonth }));
    else if (prefs.defaultMonth === 'last')
      setFilter((f) => ({ ...f, month: last }));
    sessionStorage.setItem('hw:applied-default-month', '1');
  }, [prefs.defaultMonth]);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener('hw:open-settings', open);
    return () => window.removeEventListener('hw:open-settings', open);
  }, []);

  // Persist local
  useEffect(() => {
    localStorage.setItem("hematwoi:v3", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem("hematwoi:v3:catMeta", JSON.stringify(catMeta));
  }, [catMeta]);

  // Cloud fetch when toggled on and user available
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
      // res.rows diharapkan sudah mengandung: { id, date, type, amount, note, category }
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

  // --- Transactions CRUD ---
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
        // normalisasi agar FE tetap punya name kategori
        const res = { ...saved, category: tx.category };
        setData((d) => ({ ...d, txs: [res, ...d.txs] }));
      } catch (e) {
        alert("Gagal menambah transaksi: " + e.message);
      }
    } else {
      setData((d) => ({ ...d, txs: [{ ...tx, id: uid() }, ...d.txs] }));
    }
  };

  const updateTx = async (id, patch) => {
    if (useCloud && sessionUser) {
      try {
        const payload = { ...patch };
        if (payload.category && catMap[payload.category]) {
          payload.category_id = catMap[payload.category];
        }
        const saved = await apiUpdate(id, payload);
        const res = { ...saved, category: saved.category }; // pastikan ada kategori di FE
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

  // --- Categories ---
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
    setShowCat(false);
  };

  useEffect(() => {
    const onSaveMeta = async (e) => {
      const detail = e.detail || {};
      const all = [...(detail.income || []), ...(detail.expense || [])];
      const meta = {};
      all.forEach((c) => {
        meta[c.name] = { color: c.color, type: c.type, sort: c.sort };
      });
      setCatMeta(meta);
      if (useCloud && sessionUser) {
        try {
          const { data: rows, error } = await supabase
            .from("categories")
            .select("id,name");
          if (error) throw error;
          const idMap = {};
          (rows || []).forEach((r) => (idMap[r.name] = r.id));
          for (const c of all) {
            const id = idMap[c.name];
            if (!id) continue;
            await supabase
              .from("categories")
              .update({ color: c.color, sort_order: c.sort })
              .eq("id", id);
          }
        } catch (err) {
          console.error("update category meta failed", err);
        }
      }
    };
    window.addEventListener("hw:save-cat-meta", onSaveMeta);
    return () => window.removeEventListener("hw:save-cat-meta", onSaveMeta);
  }, [useCloud, sessionUser]);

  // --- Budgets ---
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

  // --- Derived data ---
  const months = useMemo(() => {
    const set = new Set(data.txs.map((t) => String(t.date).slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [data.txs]);

  const filtered = useMemo(() => {
    return data.txs.filter((t) => {
      if (filter.type !== "all" && t.type !== filter.type) return false;
      if (filter.month !== "all" && String(t.date).slice(0, 7) !== filter.month)
        return false;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        const note = t.note?.toLowerCase() || "";
        const cat = t.category?.toLowerCase() || "";
        if (!note.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });
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

  // --- T6: Export & Import handlers ---
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

      // deteksi header
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
        const cols = lines[i].split(",");
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

  const isLoading = useCloud && data.txs.length === 0;

  return (
    <CategoryProvider catMeta={catMeta}>
      <TopBar stats={stats} useCloud={useCloud} setUseCloud={setUseCloud} />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div ref={addRef}>
            <AddForm categories={data.cat} onAdd={addTx} />
          </div>
          <Filters months={months} filter={filter} setFilter={setFilter} />
          <Summary stats={stats} />
          <DataTools
            onExport={handleExport}
            onImportJSON={handleImportJSON}
            onImportCSV={handleImportCSV}
            onManageCat={() => setShowCat(true)}
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <DashboardCharts
            month={filter.month === "all" ? currentMonth : filter.month}
            txs={data.txs}
          />
        )}

        <ReportFilters
          month={reportMonth}
          months={months}
          comparePrev={comparePrev}
          onToggleCompare={setComparePrev}
          onChange={setReportMonth}
        />
        <Reports
          month={reportMonth}
          months={months}
          txs={data.txs}
          budgets={data.budgets}
          comparePrevEnabled={comparePrev}
        />

        <BudgetSection
          filterMonth={filter.month === "all" ? currentMonth : filter.month}
          budgets={data.budgets}
          txs={data.txs}
          categories={data.cat}
          onAdd={addBudget}
          onRemove={removeBudget}
        />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Daftar Transaksi</h2>
          </div>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : filtered.length === 0 ? (
            <div className="card text-center">
              <div className="mb-2">Belum ada transaksi.</div>
              <button
                className="btn btn-primary"
                onClick={() =>
                  addRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
              >
                Tambah Transaksi
              </button>
            </div>
          ) : (
            <TxTable items={filtered} onRemove={removeTx} onUpdate={updateTx} />
          )}
        </div>
      </main>

      <Modal
        open={showCat}
        title="Kelola Kategori"
        onClose={() => setShowCat(false)}
      >
        <ManageCategories cat={data.cat} onSave={saveCategories} />
      </Modal>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        value={{ theme, ...prefs }}
        onChange={(val) => {
          const { theme: nextTheme, density, defaultMonth, currency } = val;
          setTheme(nextTheme);
          setPrefs({ density, defaultMonth, currency });
        }}
      />

    </CategoryProvider>
  );
}
