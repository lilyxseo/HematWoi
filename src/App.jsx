import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  listTransactions,
  addTransaction as apiAdd,
  updateTransaction as apiUpdate,
  deleteTransaction as apiDelete,
  upsertCategories,
} from "./lib/api";

// ==== UTILITAS ==========================================
const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" });
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
  } catch (e) {
    console.warn("Failed to parse local data", e);
    return { txs: [], cat: defaultCategories, budgets: [], ver: 2 };
  }
}

function saveData(state) {
  localStorage.setItem("hematwoi:v2", JSON.stringify(state));
}

// ==== KOMPONEN INTI =====================================
export default function App() {
  const [data, setData] = useState(loadInitial); // { txs, cat, budgets, ver }
  const [filter, setFilter] = useState({ type: "all", q: "", month: "all" });
  const [showCat, setShowCat] = useState(false);

  // final: pakai useCloud + sessionUser
  const [useCloud, setUseCloud] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cloudAll, setCloudAll] = useState([]); // daftar semua transaksi cloud untuk daftar bulan
  const [catMap, setCatMap] = useState({}); // nama -> id kategori di Supabase

  // sync user dari Supabase Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSessionUser(data.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSessionUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // simpan ke localStorage hanya bila tidak sedang Cloud mode
  useEffect(() => {
    if (!useCloud || !sessionUser) saveData(data);
  }, [data, useCloud, sessionUser]);

  // ketika pindah mode / user berubah
  useEffect(() => {
    if (useCloud && sessionUser) {
      loadCategories();
      fetchCloud(filter);
    } else {
      // kembali ke data lokal
      setData(loadInitial());
      setCloudAll([]);
    }
  }, [useCloud, sessionUser]);

  // refetch saat filter berubah di Cloud mode
  useEffect(() => {
    if (useCloud && sessionUser) fetchCloud(filter);
  }, [filter, useCloud, sessionUser]);

  const addTx = async (tx) => {
    if (useCloud && sessionUser) {
      setLoading(true); setError("");
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
      setLoading(true); setError("");
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
      setLoading(true); setError("");
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
    setLoading(true); setError("");
    try {
      const { rows } = await listTransactions({ ...filt, pageSize: 1000 });
      setData((d) => ({ ...d, txs: rows }));
      // simpan daftar penuh untuk dropdown bulan hanya kalau filter = all
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
  }, [data.txs, useCloud, sessionUser, cloudAll]);

  const filtered = useMemo(() => {
    // di Cloud mode: server-side filtering sudah dilakukan
    if (useCloud && sessionUser) return data.txs;

    // di Local mode: filter di client
    return data.txs.filter((t) => {
      const okType = filter.type === "all" || t.type === filter.type;
      const okMonth = filter.month === "all" || (t.date || "").startsWith(filter.month);
      const q = filter.q.trim().toLowerCase();
      const okQ = !q || [t.category, t.note].join(" ").toLowerCase().includes(q);
      return okType && okMonth && okQ;
    });
  }, [data.txs, filter, useCloud, sessionUser]);

  const stats = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);
    return { income, expense, balance: income - expense };
  }, [filtered]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hematwoi-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.txs)) throw new Error("Format tidak valid");
        setData({ txs: parsed.txs, cat: parsed.cat || defaultCategories, budgets: parsed.budgets || [], ver: 2 });
      } catch (e) {
        alert("Gagal import: " + e.message);
      }
    };
    reader.readAsText(file);
  };

  const importCSV = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = String(reader.result).trim().split(/\r?\n/);
        const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const idx = {
          date: header.indexOf("date"),
          type: header.indexOf("type"),
          category: header.indexOf("category"),
          note: header.indexOf("note"),
          amount: header.indexOf("amount"),
        };
        if (Object.values(idx).some((i) => i === -1)) throw new Error("Header wajib: date,type,category,note,amount");
        const rows = lines.slice(1).filter(Boolean).map((ln) => ln.split(","));
        const txs = rows.map((r) => ({
          id: uid(),
          date: r[idx.date]?.trim(),
          type: r[idx.type]?.trim().toLowerCase() === "income" ? "income" : "expense",
          category: r[idx.category]?.trim() || "Lainnya",
          note: r[idx.note]?.trim() || "",
          amount: Number(r[idx.amount] || 0),
        })).filter((t) => t.date && t.amount > 0);
        setData((d) => ({ ...d, txs: [...txs, ...d.txs] }));
        alert(`Import CSV sukses: ${txs.length} baris ditambahkan`);
      } catch (e) {
        alert("Gagal import CSV: " + e.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <TopBar stats={stats} useCloud={useCloud} setUseCloud={setUseCloud} />
      {loading && <div className="max-w-5xl mx-auto p-4 text-sm">Loading…</div>}
      {error && <div className="max-w-5xl mx-auto p-4 text-sm text-red-600">{error}</div>}

      <main className="max-w-5xl mx-auto p-4">
        <Card>
          <h2 className="text-lg font-semibold">Tambah Transaksi</h2>
          <AddForm categories={data.cat} onAdd={addTx} />
        </Card>

        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <Card>
            <h3 className="font-semibold mb-2">Filter</h3>
            <Filters months={months} filter={filter} setFilter={setFilter} />
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">Ringkasan</h3>
            <Summary stats={stats} />
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">Data</h3>
            <DataTools onExport={exportJSON} onImportJSON={importJSON} onImportCSV={importCSV} onManageCat={() => setShowCat(true)} />
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <Card className="md:col-span-3">
            <h2 className="text-lg font-semibold">Budget Bulanan</h2>
            <BudgetSection
              filterMonth={filter.month === "all" ? new Date().toISOString().slice(0, 7) : filter.month}
              budgets={data.budgets}
              txs={data.txs}
              categories={data.cat}
              onAdd={addBudget}
              onRemove={removeBudget}
            />
          </Card>
        </div>

        <Card className="mt-4">
          <h2 className="text-lg font-semibold">Daftar Transaksi</h2>
          <TxTable items={filtered} onRemove={removeTx} onUpdate={updateTx} />
        </Card>
      </main>

      <Footer />

      {showCat && (
        <Modal onClose={() => setShowCat(false)} title="Kelola Kategori">
          <ManageCategories
            cat={data.cat}
            onSave={async (next) => {
              if (useCloud && sessionUser) {
                const rows = await upsertCategories(next);
                const cat = { income: [], expense: [] };
                const map = {};
                (rows || []).forEach((c) => {
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

// ==== SUBKOMPONEN =======================================
function TopBar({ stats, useCloud, setUseCloud }) {
  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <h1 className="text-xl font-bold">HematWoi</h1>
          <span className="text-xs ml-2 px-2 py-1 bg-slate-100 rounded">{useCloud ? "Cloud" : "Local"}</span>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={useCloud} onChange={(e) => setUseCloud(e.target.checked)} />
            Cloud
          </label>
          <div className="text-right">
            <div className="text-xs text-slate-500">Saldo</div>
            <div className="text-lg font-semibold">{idr.format(stats.balance)}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span className="inline-grid place-items-center w-7 h-7 font-extrabold text-sm rounded-lg bg-sky-500 text-white">
      HW
    </span>
  );
}

function Card({ children, className = "" }) {
  return <section className={`bg-white rounded-xl shadow-sm border p-4 ${className}`}>{children}</section>;
}

function AddForm({ categories, onAdd }) {
  const [form, setForm] = useState({
    date: today(),
    type: "expense",
    category: "Makan",
    note: "",
    amount: "",
  });

  useEffect(() => {
    // Sinkronkan default kategori saat tipe berubah
    const list = form.type === "income" ? categories.income : categories.expense;
    if (!list.includes(form.category)) setForm((f) => ({ ...f, category: list[0] || "Lainnya" }));
  }, [form.type, categories, form.category]);

  const submit = (e) => {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.date || !form.type || !form.category || isNaN(amt) || amt <= 0) {
      alert("Mohon isi data dengan benar");
      return;
    }
    onAdd({ ...form, amount: amt });
    setForm((f) => ({ ...f, note: "", amount: "" }));
  };

  return (
    <form onSubmit={submit} className="grid md:grid-cols-5 gap-2 items-end">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Tanggal</label>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Tipe</label>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20">
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Kategori</label>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20">
          {(form.type === "income" ? categories.income : categories.expense).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Catatan</label>
        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="opsional" className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" />
      </div>
      <div className="md:col-span-1 flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">Jumlah</label>
          <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-3 py-2 border border-sky-500 rounded-lg bg-sky-500 text-white cursor-pointer self-end"
        >
          Tambah
        </button>
      </div>
    </form>
  );
}

function Filters({ months, filter, setFilter }) {
  return (
    <div className="grid gap-2">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Jenis</label>
        <select className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" value={filter.type} onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}>
          <option value="all">Semua</option>
          <option value="income">Pemasukan</option>
          <option value="expense">Pengeluaran</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Bulan</label>
        <select className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" value={filter.month} onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))}>
          {months.map((m) => (
            <option key={m} value={m}>
              {m === "all" ? "Semua" : m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Cari</label>
        <input className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" placeholder="kategori / catatan" value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} />
      </div>
    </div>
  );
}

function Summary({ stats }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <SmallStat label="Pemasukan" value={idr.format(stats.income)} note="Total" pos />
      <SmallStat label="Pengeluaran" value={idr.format(stats.expense)} note="Total" />
      <SmallStat label="Saldo" value={idr.format(stats.balance)} note="(In - Out)" bold />
    </div>
  );
}

function SmallStat({ label, value, note, pos = false, bold = false }) {
  return (
    <div className="p-3 rounded-lg border bg-slate-50">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-base ${bold ? "font-bold" : "font-semibold"}`}>{value}</div>
      <div className={`text-[11px] ${pos ? "text-emerald-600" : "text-slate-500"}`}>{note}</div>
    </div>
  );
}

function DataTools({ onExport, onImportJSON, onImportCSV, onManageCat }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer"
        onClick={onExport}
      >
        Export JSON
      </button>
      <label className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer">
        Import JSON
        <input
          type="file"
          accept="application/json"
          onChange={(e) => e.target.files?.[0] && onImportJSON(e.target.files[0])}
          className="hidden"
        />
      </label>
      <label className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer">
        Import CSV
        <input
          type="file"
          accept="text/csv"
          onChange={(e) => e.target.files?.[0] && onImportCSV(e.target.files[0])}
          className="hidden"
        />
      </label>
      <button
        className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg bg-white cursor-pointer"
        onClick={onManageCat}
      >
        Kelola Kategori
      </button>
    </div>
  );
}

function BudgetSection({ filterMonth, budgets, txs, categories, onAdd, onRemove }) {
  const [form, setForm] = useState({ month: filterMonth, category: categories.expense[0] || "Lainnya", limit: "" });

  useEffect(() => setForm((f) => ({ ...f, month: filterMonth })), [filterMonth]);

  const currentBudgets = budgets.filter((b) => b.month === filterMonth);

  const spentByCat = useMemo(() => {
    const map = {};
    txs
      .filter((t) => t.type === "expense" && t.date?.startsWith(filterMonth))
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount || 0);
      });
    return map;
  }, [txs, filterMonth]);

  const submit = (e) => {
    e.preventDefault();
    const lim = Number(form.limit);
    if (!form.month || !form.category || isNaN(lim) || lim <= 0) return alert("Isi budget dengan benar");
    onAdd({ month: form.month, category: form.category, limit: lim });
    setForm((f) => ({ ...f, limit: "" }));
  };

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div>
        <form onSubmit={submit} className="grid grid-cols-3 gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Bulan</label>
            <input className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} placeholder="YYYY-MM" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Kategori</label>
            <select className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.expense.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Limit</label>
              <input className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" type="number" inputMode="decimal" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} />
            </div>
            <button
              className="inline-flex items-center gap-2 px-3 py-2 border border-sky-500 rounded-lg bg-sky-500 text-white cursor-pointer self-end"
            >
              Tambah
            </button>
          </div>
        </form>
        <p className="text-xs text-slate-500 mt-1">Contoh bulan: 2025-09</p>
      </div>

      <div>
        {!currentBudgets.length ? (
          <p className="text-sm text-slate-500">Belum ada budget untuk {filterMonth}.</p>
        ) : (
          <div className="grid gap-2">
            {currentBudgets.map((b) => {
              const spent = spentByCat[b.category] || 0;
              const pct = Math.min(100, Math.round((spent / b.limit) * 100));
              const isOver = spent > b.limit;
              return (
                <div key={b.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between text-sm">
                    <div>
                      <b>{b.category}</b> — {b.month}
                    </div>
                    <div>
                      {idr.format(spent)} / {idr.format(b.limit)}
                    </div>
                  </div>
                  <div
                    className={`h-2 bg-indigo-50 rounded-full overflow-hidden border border-slate-200 mt-1 mb-1 ${isOver ? "outline outline-2 outline-red-300" : ""}`}
                  >
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-blue-300"
                      style={{ width: pct + "%" }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{pct}% terpakai</span>
                    <button
                      className="inline-flex items-center gap-2 px-2 py-1 text-sm border border-red-500 rounded-md text-red-500 hover:bg-red-50 cursor-pointer"
                      onClick={() => onRemove(b.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ManageCategories({ cat, onSave }) {
  const [income, setIncome] = useState(cat.income.join("\n"));
  const [expense, setExpense] = useState(cat.expense.join("\n"));

  useEffect(() => {
    setIncome(cat.income.join("\n"));
    setExpense(cat.expense.join("\n"));
  }, [cat]);

  const save = async () => {
    const parse = (s) => Array.from(new Set(s.split(/\n+/).map((x) => x.trim()).filter(Boolean)));
    const next = { income: parse(income), expense: parse(expense) };
    if (!next.income.length || !next.expense.length) return alert("Minimal 1 kategori di masing-masing tipe");
    try {
      await onSave(next);
      alert("Kategori tersimpan");
    } catch (e) {
      alert("Gagal menyimpan kategori: " + e.message);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div>
        <h4 className="font-semibold mb-1">Pemasukan</h4>
        <textarea className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" rows={8} value={income} onChange={(e) => setIncome(e.target.value)} />
        <p className="text-xs text-slate-500 mt-1">1 baris = 1 kategori</p>
      </div>
      <div>
        <h4 className="font-semibold mb-1">Pengeluaran</h4>
        <textarea className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" rows={8} value={expense} onChange={(e) => setExpense(e.target.value)} />
        <p className="text-xs text-slate-500 mt-1">Contoh: Makan, Transport, Tagihan…</p>
      </div>
      <div className="md:col-span-2 text-right">
        <button
          className="inline-flex items-center gap-2 px-3 py-2 border border-sky-500 rounded-lg bg-sky-500 text-white cursor-pointer"
          onClick={save}
        >
          Simpan Kategori
        </button>
      </div>
    </div>
  );
}

function TxTable({ items, onRemove, onUpdate }) {
  if (!items.length) return <p className="text-sm text-slate-500">Belum ada data…</p>;

  return (
    <div className="overflow-auto">
      <table className="w-full border-separate [border-spacing:0_0.5rem]">
        <thead>
          <tr>
            <th className="text-left text-xs text-slate-500 px-2 py-1">Tanggal</th>
            <th className="text-left text-xs text-slate-500 px-2 py-1">Jenis</th>
            <th className="text-left text-xs text-slate-500 px-2 py-1">Kategori</th>
            <th className="text-left text-xs text-slate-500 px-2 py-1">Catatan</th>
            <th className="text-right text-xs text-slate-500 px-2 py-1">Jumlah</th>
            <th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <Row key={t.id} t={t} onRemove={onRemove} onUpdate={onUpdate} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ t, onRemove, onUpdate }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(t);

  useEffect(() => setForm(t), [t]);

  const save = () => {
    const amt = Number(form.amount);
    if (!form.date || !form.type || !form.category || isNaN(amt) || amt <= 0) {
      alert("Data tidak valid");
      return;
    }
    onUpdate(t.id, { ...form, amount: amt });
    setEdit(false);
  };

  return (
    <tr>
      <td className="bg-white border-y border-slate-200 p-2 first:rounded-l-lg first:border-l">
        {edit ? (
          <input
            type="date"
            className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        ) : (
          t.date
        )}
      </td>
      <td className="bg-white border-y border-slate-200 p-2">
        {edit ? (
          <select
            className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
          </select>
        ) : (
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs border ${
              t.type === "income"
                ? "bg-green-50 text-green-600 border-green-300"
                : "bg-pink-50 text-pink-600 border-pink-300"
            }`}
          >
            {t.type === "income" ? "In" : "Out"}
          </span>
        )}
      </td>
      <td className="bg-white border-y border-slate-200 p-2">
        {edit ? (
          <input
            className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        ) : (
          t.category
        )}
      </td>
      <td className="bg-white border-y border-slate-200 p-2">
        {edit ? (
          <input
            className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        ) : (
          t.note || "—"
        )}
      </td>
      <td className="bg-white border-y border-slate-200 p-2 text-right">
        {edit ? (
          <input
            type="number"
            className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        ) : (
          idr.format(t.amount)
        )}
      </td>
      <td className="bg-white border-y border-slate-200 p-2 text-right last:rounded-r-lg last:border-r">
        {edit ? (
          <div className="flex gap-1 justify-end">
            <button
              className="inline-flex items-center gap-2 px-2 py-1 text-sm border border-slate-300 rounded-md bg-white cursor-pointer"
              onClick={save}
            >
              Simpan
            </button>
            <button
              className="inline-flex items-center gap-2 px-2 py-1 text-sm border border-slate-300 rounded-md bg-transparent cursor-pointer"
              onClick={() => {
                setEdit(false);
                setForm(t);
              }}
            >
              Batal
            </button>
          </div>
        ) : (
          <div className="flex gap-1 justify-end">
            <button
              className="inline-flex items-center gap-2 px-2 py-1 text-sm border border-slate-300 rounded-md bg-white cursor-pointer"
              onClick={() => setEdit(true)}
            >
              Edit
            </button>
            <button
              className="inline-flex items-center gap-2 px-2 py-1 text-sm border border-red-500 rounded-md text-red-500 hover:bg-red-50 cursor-pointer"
              onClick={() => onRemove(t.id)}
            >
              Hapus
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 grid place-items-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[800px] bg-white border border-slate-200 rounded-xl p-4 shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            className="inline-flex items-center gap-2 px-2 py-1 text-sm border border-slate-300 rounded-md bg-white cursor-pointer"
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
        {children}
      </div>
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

