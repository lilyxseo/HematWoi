import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  listTransactions,
  addTransaction as apiAdd,
  updateTransaction as apiUpdate,
  deleteTransaction as apiDelete,
  upsertCategories,
} from "./lib/api";

import TopBar from "./components/TopBar.jsx";
import Card from "./components/Card.jsx";
import AddForm from "./components/AddForm.jsx";
import Filters from "./components/Filters.jsx";
import Summary from "./components/Summary.jsx";
import DataTools from "./components/DataTools.jsx";
import TxTable from "./components/TxTable.jsx";
import BudgetSection from "./components/BudgetSection.jsx";
import ManageCategories from "./components/ManageCategories.jsx";
import Modal from "./components/Modal.jsx";
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

const defaultCategories = {
  income: ["Gaji", "Bonus", "Lainnya"],
  expense: ["Makan", "Transport", "Belanja", "Tagihan", "Kesehatan", "Hiburan", "Lainnya"],
};

function loadInitial() {
  try {
    const raw = localStorage.getItem("hematwoi:v2");
    if (!raw) return { txs: [], cat: defaultCategories, budgets: [], ver: 2 };
    const parsed = JSON.parse(raw);
    return {
      txs: parsed.txs ?? [],
      cat: parsed.cat ?? defaultCategories,
      budgets: parsed.budgets ?? [],
      ver: 2,
    };
  } catch {
    return { txs: [], cat: defaultCategories, budgets: [], ver: 2 };
  }
}

function saveData(state) {
  localStorage.setItem("hematwoi:v2", JSON.stringify(state));
}

export default function App() {
  const [data, setData] = useState(loadInitial); // { txs, cat, budgets, ver }
  const [filter, setFilter] = useState({ type: "all", q: "", month: "all" });
  const [showCat, setShowCat] = useState(false);

  const [useCloud, setUseCloud] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cloudAll, setCloudAll] = useState([]);
  const [catMap, setCatMap] = useState({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSessionUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!useCloud || !sessionUser) saveData(data);
  }, [data, useCloud, sessionUser]);

  useEffect(() => {
    if (useCloud && sessionUser) {
      loadCategories();
    } else {
      setData(loadInitial());
      setCloudAll([]);
    }
  }, [useCloud, sessionUser]);

  useEffect(() => {
    if (useCloud && sessionUser) fetchCloud(filter);
  }, [filter, useCloud, sessionUser]);

  const addTx = async (tx) => {
    if (useCloud && sessionUser) {
      setLoading(true);
      setError("");
      try {
        const saved = await apiAdd({
          date: tx.date,
          type: tx.type,
          amount: tx.amount,
          note: tx.note,
          category_id: catMap[tx.category] || null,
        });
        const res = { ...saved, category: tx.category };
        setData((d) => ({ ...d, txs: [res, ...d.txs] }));
        setCloudAll((d) => [res, ...d]);
      } catch (e) {
        setError(e.message);
        alert("Gagal menambah transaksi: " + e.message);
      } finally {
        setLoading(false);
      }
    } else {
      setData((d) => ({ ...d, txs: [{ ...tx, id: uid() }, ...d.txs] }));
    }
  };

  const removeTx = async (id) => {
    if (useCloud && sessionUser) {
      setLoading(true);
      setError("");
      try {
        await apiDelete(id);
        setData((d) => ({ ...d, txs: d.txs.filter((t) => t.id !== id) }));
        setCloudAll((d) => d.filter((t) => t.id !== id));
      } catch (e) {
        setError(e.message);
        alert("Gagal menghapus transaksi: " + e.message);
      } finally {
        setLoading(false);
      }
    } else {
      setData((d) => ({ ...d, txs: d.txs.filter((t) => t.id !== id) }));
    }
  };

  const updateTx = async (id, patch) => {
    if (useCloud && sessionUser) {
      setLoading(true);
      setError("");
      try {
        const saved = await apiUpdate(id, {
          date: patch.date,
          type: patch.type,
          note: patch.note,
          amount: patch.amount,
          category_id: patch.category ? catMap[patch.category] || null : undefined,
        });
        const res = { ...saved, category: patch.category ?? saved.category };
        setData((d) => ({ ...d, txs: d.txs.map((t) => (t.id === id ? res : t)) }));
        setCloudAll((d) => d.map((t) => (t.id === id ? res : t)));
      } catch (e) {
        setError(e.message);
        alert("Gagal mengubah transaksi: " + e.message);
      } finally {
        setLoading(false);
      }
    } else {
      setData((d) => ({ ...d, txs: d.txs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    }
  };

  const addBudget = (b) => setData((d) => ({ ...d, budgets: [{ ...b, id: uid() }, ...d.budgets] }));
  const removeBudget = (id) => setData((d) => ({ ...d, budgets: d.budgets.filter((b) => b.id !== id) }));

  async function fetchCloud(filt) {
    setLoading(true);
    setError("");
    try {
      const { rows } = await listTransactions({ ...filt, pageSize: 1000 });
      setData((d) => ({ ...d, txs: rows }));
      if (filt.type === "all" && filt.month === "all" && !filt.q) {
        setCloudAll(rows);
      }
    } catch (e) {
      setError(e.message);
      alert("Gagal memuat data: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const { data: cats, error: err } = await supabase
        .from("categories")
        .select("id,name,type");
      if (err) throw err;
      const cat = { income: [], expense: [] };
      const map = {};
      (cats || []).forEach((c) => {
        cat[c.type] = [...(cat[c.type] || []), c.name];
        map[c.name] = c.id;
      });
      setData((d) => ({ ...d, cat }));
      setCatMap(map);
    } catch (e) {
      alert("Gagal memuat kategori: " + e.message);
    }
  }

  const months = useMemo(() => {
    const source = useCloud && sessionUser ? cloudAll : data.txs;
    const m = new Set(source.map((t) => t.date?.slice(0, 7)).filter(Boolean));
    m.add(new Date().toISOString().slice(0, 7));
    return ["all", ...Array.from(m).sort().reverse()];
  }, [data.txs, cloudAll, useCloud, sessionUser]);

  const filtered = useMemo(() => {
    return data.txs.filter((t) => {
      if (filter.type !== "all" && t.type !== filter.type) return false;
      if (filter.month !== "all" && !t.date?.startsWith(filter.month)) return false;
      if (filter.q && !(t.category + t.note).toLowerCase().includes(filter.q.toLowerCase())) return false;
      return true;
    });
  }, [data.txs, filter]);

  const stats = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((a, b) => a + Number(b.amount), 0);
    const expense = filtered.filter((t) => t.type === "expense").reduce((a, b) => a + Number(b.amount), 0);
    return { income, expense, balance: income - expense, count: filtered.length };
  }, [filtered]);

  const onExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hematwoi-data.json";
    a.click();
  };

  const onImportJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setData(parsed);
        alert("Import sukses!");
      } catch {
        alert("File JSON tidak valid");
      }
    };
    reader.readAsText(file);
  };

  const onImportCSV = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = String(reader.result).split(/\n+/).filter(Boolean);
        const txs = lines.map((l) => {
          const [date, type, category, amount, note] = l.split(",");
          return { id: uid(), date, type, category, amount: Number(amount), note };
        });
        setData((d) => ({ ...d, txs: [...txs, ...d.txs] }));
        alert(`Import CSV sukses: ${txs.length} baris ditambahkan`);
      } catch {
        alert("File CSV tidak valid");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <TopBar stats={stats} useCloud={useCloud} setUseCloud={setUseCloud} />
      {loading && <div className="max-w-5xl mx-auto p-4 text-sm">Loading…</div>}
      {error && <div className="max-w-5xl mx-auto p-4 text-sm text-red-600">{error}</div>}
      <div className="max-w-5xl mx-auto p-4">
        <Card>
          <AddForm categories={data.cat} onAdd={addTx} />
        </Card>
        <Card className="mt-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Filters months={months} filter={filter} setFilter={setFilter} />
            <Summary stats={stats} />
            <DataTools
              onExport={onExport}
              onImportJSON={onImportJSON}
              onImportCSV={onImportCSV}
              onManageCat={() => setShowCat(true)}
            />
          </div>
        </Card>
        <Card className="mt-4">
          <BudgetSection
            filterMonth={filter.month === "all" ? today().slice(0, 7) : filter.month}
            budgets={data.budgets}
            txs={data.txs}
            categories={data.cat}
            onAdd={addBudget}
            onRemove={removeBudget}
          />
        </Card>
        <Card className="mt-4">
          <TxTable items={filtered} onRemove={removeTx} onUpdate={updateTx} />
        </Card>
        <Footer />
      </div>
      {showCat && (
        <Modal title="Kelola Kategori" onClose={() => setShowCat(false)}>
          <ManageCategories
            cat={data.cat}
            onSave={async (next) => {
              if (useCloud && sessionUser) {
                const saved = await upsertCategories(next);
                const map = {};
                const cat = { income: [], expense: [] };
                saved.forEach((c) => {
                  cat[c.type] = [...(cat[c.type] || []), c.name];
                  map[c.name] = c.id;
                });
                setData((d) => ({ ...d, cat }));
                setCatMap(map);
              } else {
                setData((d) => ({ ...d, cat: next }));
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="py-8 text-center text-xs text-slate-400">
      Made with ❤️ — Data lokal di browser. Logo: HW. Siap dihubungkan ke backend (PHP+MySQL / PocketBase / Express) kapan saja.
    </footer>
  );
}
