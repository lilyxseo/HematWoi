import { useEffect, useMemo, useState } from "react";
import TopBar from "./components/TopBar";
import AddForm from "./components/AddForm";
import Filters from "./components/Filters";
import Summary from "./components/Summary";
import DataTools from "./components/DataTools";
import TxTable from "./components/TxTable";
import BudgetSection from "./components/BudgetSection";
import Modal from "./components/Modal";
import ManageCategories from "./components/ManageCategories";
import { supabase } from "./lib/supabase";
import {
  listTransactions,
  addTransaction as apiAdd,
  updateTransaction as apiUpdate,
  deleteTransaction as apiDelete,
  listCategories,
  upsertCategories,
} from "./lib/api";

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
  const [showCat, setShowCat] = useState(false);

  const [useCloud, setUseCloud] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [catMap, setCatMap] = useState({}); // name -> id (cloud)

  // Supabase auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSessionUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Persist local
  useEffect(() => {
    localStorage.setItem("hematwoi:v3", JSON.stringify(data));
  }, [data]);

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
      const rows = await listCategories();
      const income = rows.filter((r) => r.type === "income").map((r) => r.name);
      const expense = rows.filter((r) => r.type === "expense").map((r) => r.name);
      const map = {};
      rows.forEach((r) => (map[r.name] = r.id));
      setCatMap(map);
      setData((d) => ({ ...d, cat: { income, expense } }));
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

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <>
      <TopBar stats={stats} useCloud={useCloud} setUseCloud={setUseCloud} />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <AddForm categories={data.cat} onAdd={addTx} />
          <Filters months={months} filter={filter} setFilter={setFilter} />
          <Summary stats={stats} />
          <DataTools
            onExport={handleExport}
            onImportJSON={handleImportJSON}
            onImportCSV={handleImportCSV}
            onManageCat={() => setShowCat(true)}
          />
        </div>

        <BudgetSection
          filterMonth={filter.month === "all" ? currentMonth : filter.month}
          budgets={data.budgets}
          txs={data.txs}
          categories={data.cat}
          onAdd={addBudget}
          onRemove={removeBudget}
        />

        <TxTable items={filtered} onRemove={removeTx} onUpdate={updateTx} />
      </main>

      <Modal
        open={showCat}
        title="Kelola Kategori"
        onClose={() => setShowCat(false)}
      >
        <ManageCategories cat={data.cat} onSave={saveCategories} />
      </Modal>
    </>
  );
}
