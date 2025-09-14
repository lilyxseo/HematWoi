import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  listTransactions,
  addTransaction as apiAdd,
  updateTransaction as apiUpdate,
  deleteTransaction as apiDelete,
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
  const [useCloud, setUseCloud] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cloudAll, setCloudAll] = useState([]); // daftar semua transaksi cloud untuk daftar bulan
  const [catMap, setCatMap] = useState({}); // nama -> id kategori di Supabase

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionUser(data.session?.user || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionUser(session?.user || null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => { if (!useCloud || !sessionUser) saveData(data); }, [data, useCloud, sessionUser]);

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
      if (filt.type === 'all' && filt.month === 'all' && !filt.q) {
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
        .from('categories')
        .select('id,name,type');
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
    if (useCloud && sessionUser) return data.txs;
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
          <ManageCategories cat={data.cat} onChange={(cat) => setData((d) => ({ ...d, cat }))} />
        </Modal>
      )}

      <style>{css}</style>
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
          <span className="text-xs ml-2 px-2 py-1 bg-slate-100 rounded">{useCloud ? 'Cloud' : 'Local'}</span>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={useCloud} onChange={(e)=>setUseCloud(e.target.checked)} />
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
    <span className="logo">HW</span>
  );
}

function Card({ children, className = "" }) {
  return (
    <section className={`bg-white rounded-xl shadow-sm border p-4 ${className}`}>{children}</section>
  );
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
        <label className="lbl">Tanggal</label>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="inp" />
      </div>
      <div>
        <label className="lbl">Tipe</label>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="inp">
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
        </select>
      </div>
      <div>
        <label className="lbl">Kategori</label>
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="inp"
        >
          {(form.type === "income" ? categories.income : categories.expense).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl">Catatan</label>
        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="opsional" className="inp" />
      </div>
      <div className="md:col-span-1 flex gap-2">
        <div className="flex-1">
          <label className="lbl">Jumlah</label>
          <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="inp" />
        </div>
        <button type="submit" className="btn primary self-end">Tambah</button>
      </div>
    </form>
  );
}

function Filters({ months, filter, setFilter }) {
  return (
    <div className="grid gap-2">
      <div>
        <label className="lbl">Jenis</label>
        <select className="inp" value={filter.type} onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}>
          <option value="all">Semua</option>
          <option value="income">Pemasukan</option>
          <option value="expense">Pengeluaran</option>
        </select>
      </div>
      <div>
        <label className="lbl">Bulan</label>
        <select className="inp" value={filter.month} onChange={(e) => setFilter((f) => ({ ...f, month: e.target.value }))}>
          {months.map((m) => (
            <option key={m} value={m}>{m === "all" ? "Semua" : m}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl">Cari</label>
        <input className="inp" placeholder="kategori / catatan" value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} />
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
      <button className="btn" onClick={onExport}>Export JSON</button>
      <label className="btn">
        Import JSON
        <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && onImportJSON(e.target.files[0])} className="hidden" />
      </label>
      <label className="btn">
        Import CSV
        <input type="file" accept="text/csv" onChange={(e) => e.target.files?.[0] && onImportCSV(e.target.files[0])} className="hidden" />
      </label>
      <button className="btn" onClick={onManageCat}>Kelola Kategori</button>
    </div>
  );
}

function BudgetSection({ filterMonth, budgets, txs, categories, onAdd, onRemove }) {
  const [form, setForm] = useState({ month: filterMonth, category: categories.expense[0] || "Lainnya", limit: "" });

  useEffect(() => setForm((f) => ({ ...f, month: filterMonth })), [filterMonth]);

  const currentBudgets = budgets.filter((b) => b.month === filterMonth);

  const spentByCat = useMemo(() => {
    const map = {};
    txs.filter((t) => t.type === "expense" && t.date?.startsWith(filterMonth)).forEach((t) => {
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
            <label className="lbl">Bulan</label>
            <input className="inp" value={form.month} onChange={(e)=>setForm({...form,month:e.target.value})} placeholder="YYYY-MM" />
          </div>
          <div>
            <label className="lbl">Kategori</label>
            <select className="inp" value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}>
              {categories.expense.map((c)=>(<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="lbl">Limit</label>
              <input className="inp" type="number" inputMode="decimal" value={form.limit} onChange={(e)=>setForm({...form,limit:e.target.value})} />
            </div>
            <button className="btn primary self-end">Tambah</button>
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
                    <div><b>{b.category}</b> — {b.month}</div>
                    <div>{idr.format(spent)} / {idr.format(b.limit)}</div>
                  </div>
                  <div className={`bar ${isOver ? "over" : ""}`}>
                    <div className="fill" style={{ width: pct + "%" }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{pct}% terpakai</span>
                    <button className="btn xs danger" onClick={() => onRemove(b.id)}>Hapus</button>
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

function ManageCategories({ cat, onChange }) {
  const [income, setIncome] = useState(cat.income.join("\n"));
  const [expense, setExpense] = useState(cat.expense.join("\n"));

  const save = () => {
    const parse = (s) => Array.from(new Set(s.split(/\n+/).map((x) => x.trim()).filter(Boolean)));
    const next = { income: parse(income), expense: parse(expense) };
    if (!next.income.length || !next.expense.length) return alert("Minimal 1 kategori di masing-masing tipe");
    onChange(next);
    alert("Kategori tersimpan");
  };

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div>
        <h4 className="font-semibold mb-1">Pemasukan</h4>
        <textarea className="inp" rows={8} value={income} onChange={(e)=>setIncome(e.target.value)} />
        <p className="text-xs text-slate-500 mt-1">1 baris = 1 kategori</p>
      </div>
      <div>
        <h4 className="font-semibold mb-1">Pengeluaran</h4>
        <textarea className="inp" rows={8} value={expense} onChange={(e)=>setExpense(e.target.value)} />
        <p className="text-xs text-slate-500 mt-1">Contoh: Makan, Transport, Tagihan…</p>
      </div>
      <div className="md:col-span-2 text-right">
        <button className="btn primary" onClick={save}>Simpan Kategori</button>
      </div>
    </div>
  );
}

function TxTable({ items, onRemove, onUpdate }) {
  if (!items.length) return <p className="text-sm text-slate-500">Belum ada data…</p>;

  return (
    <div className="overflow-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Jenis</th>
            <th>Kategori</th>
            <th>Catatan</th>
            <th className="text-right">Jumlah</th>
            <th></th>
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
      <td>{edit ? <input type="date" className="inp" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})} /> : t.date}</td>
      <td>
        {edit ? (
          <select className="inp" value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
          </select>
        ) : (
          <span className={t.type === "income" ? "badge pos" : "badge neg"}>{t.type === "income" ? "In" : "Out"}</span>
        )}
      </td>
      <td>{edit ? <input className="inp" value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} /> : t.category}</td>
      <td>{edit ? <input className="inp" value={form.note} onChange={(e)=>setForm({...form,note:e.target.value})} /> : (t.note || "—")}</td>
      <td className="text-right">{edit ? <input type="number" className="inp" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})} /> : idr.format(t.amount)}</td>
      <td className="text-right">
        {edit ? (
          <div className="flex gap-1 justify-end">
            <button className="btn xs" onClick={save}>Simpan</button>
            <button className="btn xs ghost" onClick={()=>{setEdit(false); setForm(t);}}>Batal</button>
          </div>
        ) : (
          <div className="flex gap-1 justify-end">
            <button className="btn xs" onClick={()=>setEdit(true)}>Edit</button>
            <button className="btn xs danger" onClick={()=>onRemove(t.id)}>Hapus</button>
          </div>
        )}
      </td>
    </tr>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal">
      <div className="backdrop" onClick={onClose} />
      <div className="content">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn xs" onClick={onClose}>Tutup</button>
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

// ==== CSS MINI (tanpa Tailwind/Bootstrap) =================
/* eslint-disable no-useless-escape */
const css = `
:root{
  --b:#e5e7eb; --bg:#f8fafc; --tx:#0f172a; --mut:#64748b;
  --ok:#059669; --danger:#ef4444; --ring:#2563eb20; --brand:#3898f8;
}
*{box-sizing:border-box}
body{margin:0; background:var(--bg); color:var(--tx); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial}
.min-h-screen{min-height:100vh}
.max-w-5xl{max-width:72rem}
.mx-auto{margin-left:auto;margin-right:auto}
.p-4{padding:1rem}
.mt-4{margin-top:1rem}
.grid{display:grid}
.gap-2{gap:.5rem}
.gap-3{gap:.75rem}
.md\:grid-cols-3{grid-template-columns:repeat(1,minmax(0,1fr))}
@media(min-width:768px){.md\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.md\:col-span-3{grid-column:span 3 / span 3}}
.bg-white{background:#fff}
.bg-slate-50{background:#f8fafc}
.text-slate-800{color:#0f172a}
.text-slate-500{color:var(--mut)}
.border{border:1px solid var(--b)}
.rounded-xl{border-radius:12px}
.rounded-lg{border-radius:10px}
.shadow-sm{box-shadow:0 1px 2px rgba(0,0,0,.04)}
.sticky{position:sticky}
.top-0{top:0}
.z-10{z-index:10}
.font-bold{font-weight:700}
.font-semibold{font-weight:600}
.text-xl{font-size:1.25rem}
.text-lg{font-size:1.125rem}
.text-base{font-size:1rem}
.text-xs{font-size:.75rem}
.hidden{display:none}
.inp{width:100%; padding:.5rem .6rem; border:1px solid var(--b); border-radius:10px; outline:none; background:#fff}
.inp:focus{border-color:#2563eb; box-shadow:0 0 0 4px var(--ring)}
.lbl{display:block; font-size:.75rem; color:var(--mut); margin-bottom:.35rem}
.btn{display:inline-flex; align-items:center; gap:.5rem; padding:.55rem .8rem; border:1px solid var(--b); border-radius:10px; background:#fff; cursor:pointer}
.btn.primary{background:var(--brand); border-color:var(--brand); color:#fff}
.btn.ghost{background:transparent}
.btn.danger{border-color:var(--danger); color:var(--danger)}
.btn.xs{padding:.3rem .5rem; font-size:.8rem; border-radius:8px}
.badge{display:inline-block; padding:.15rem .45rem; border-radius:999px; font-size:.75rem; border:1px solid var(--b)}
.badge.pos{background:#ecfdf5; color:var(--ok); border-color:#a7f3d0}
.badge.neg{background:#fff1f2; color:#e11d48; border-color:#fecdd3}
.tbl{width:100%; border-collapse:separate; border-spacing:0 .5rem}
.tbl th{font-size:.75rem; text-align:left; color:var(--mut); padding:.25rem .5rem}
.tbl td{background:#fff; border-top:1px solid var(--b); border-bottom:1px solid var(--b); padding:.5rem}
.tbl tr td:first-child{border-left:1px solid var(--b); border-top-left-radius:10px; border-bottom-left-radius:10px}
.tbl tr td:last-child{border-right:1px solid var(--b); border-top-right-radius:10px; border-bottom-right-radius:10px}
.logo{display:inline-grid; place-items:center; width:28px; height:28px; font-weight:800; font-size:.85rem; border-radius:8px; background:var(--brand); color:#fff}
.modal{position:fixed; inset:0; display:grid; place-items:center}
.modal .backdrop{position:absolute; inset:0; background:rgba(0,0,0,.25)}
.modal .content{position:relative; z-index:1; width:min(800px,92vw); background:#fff; border:1px solid var(--b); border-radius:12px; padding:1rem; box-shadow:0 10px 30px rgba(0,0,0,.15)}
.bar{height:10px; background:#eef2ff; border-radius:999px; overflow:hidden; border:1px solid #e5e7eb; margin-top:.4rem; margin-bottom:.4rem}
.bar .fill{height:100%; background:linear-gradient(90deg, var(--brand), #87c5ff)}
.bar.over{outline:2px solid #fca5a5}
`;
/* eslint-enable no-useless-escape */
