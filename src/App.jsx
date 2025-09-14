import { useEffect, useMemo, useState } from 'react';
import TopBar from './components/TopBar';
import AddForm from './components/AddForm';
import Filters from './components/Filters';
import Summary from './components/Summary';
import DataTools from './components/DataTools';
import TxTable from './components/TxTable';
import BudgetSection from './components/BudgetSection';
import Modal from './components/Modal';
import ManageCategories from './components/ManageCategories';
import { supabase } from './lib/supabase';
import {
  listTransactions,
  addTransaction as apiAdd,
  updateTransaction as apiUpdate,
  deleteTransaction as apiDelete,
  listCategories,
  upsertCategories,
} from './lib/api';

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const defaultCategories = {
  income: ['Gaji', 'Bonus', 'Lainnya'],
  expense: ['Makan', 'Transport', 'Belanja', 'Tagihan', 'Kesehatan', 'Hiburan', 'Lainnya'],
};

function loadInitial() {
  try {
    const raw = localStorage.getItem('hematwoi:v3');
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
  const [filter, setFilter] = useState({ type: 'all', q: '', month: 'all' });
  const [showCat, setShowCat] = useState(false);

  const [useCloud, setUseCloud] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [catMap, setCatMap] = useState({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSessionUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('hematwoi:v3', JSON.stringify(data));
  }, [data]);

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
      const income = rows.filter((r) => r.type === 'income').map((r) => r.name);
      const expense = rows.filter((r) => r.type === 'expense').map((r) => r.name);
      const map = {};
      rows.forEach((r) => (map[r.name] = r.id));
      setCatMap(map);
      setData((d) => ({ ...d, cat: { income, expense } }));
    } catch (e) {
      console.error('fetch categories failed', e);
    }
  }

  async function fetchTxsCloud() {
    try {
      const res = await listTransactions({ pageSize: 1000 });
      setData((d) => ({ ...d, txs: res.rows }));
    } catch (e) {
      console.error('fetch transactions failed', e);
    }
  }

  async function fetchBudgetsCloud() {
    try {
      const { data: rows, error } = await supabase
        .from('budgets')
        .select('id,category,month,amount')
        .order('month', { ascending: false });
      if (error) throw error;
      setData((d) => ({ ...d, budgets: rows || [] }));
    } catch (e) {
      console.error('fetch budgets failed', e);
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
        setData((d) => ({ ...d, txs: [res, ...d.txs] }));
      } catch (e) {
        alert('Gagal menambah transaksi: ' + e.message);
      }
    } else {
      setData((d) => ({ ...d, txs: [{ ...tx, id: uid() }, ...d.txs] }));
    }
  };

  const updateTx = async (id, patch) => {
    if (useCloud && sessionUser) {
      try {
        const saved = await apiUpdate(id, patch);
        const res = { ...saved, category: saved.category };
        setData((d) => ({
          ...d,
          txs: d.txs.map((t) => (t.id === id ? res : t)),
        }));
      } catch (e) {
        alert('Gagal mengupdate transaksi: ' + e.message);
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
        alert('Gagal menghapus transaksi: ' + e.message);
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
        alert('Gagal menyimpan kategori: ' + e.message);
      }
    }
    setShowCat(false);
  };

  const addBudget = async ({ category, month, amount }) => {
    if (!data.cat.expense.includes(category)) return;
    const m = month.slice(0, 7);
    if (data.budgets.some((b) => b.category === category && b.month === m)) return;
    if (useCloud && sessionUser) {
      try {
        const { data: row, error } = await supabase
          .from('budgets')
          .insert({ user_id: sessionUser.id, category, month: m, amount })
          .select('id,category,month,amount')
          .single();
        if (error) throw error;
        setData((d) => ({ ...d, budgets: [...d.budgets, row] }));
      } catch (e) {
        alert('Gagal menambah budget: ' + e.message);
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
        await supabase.from('budgets').delete().eq('id', id);
      } catch (e) {
        alert('Gagal menghapus budget: ' + e.message);
        return;
      }
    }
    setData((d) => ({ ...d, budgets: d.budgets.filter((b) => b.id !== id) }));
  };

  const months = useMemo(() => {
    const set = new Set(data.txs.map((t) => t.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [data.txs]);

  const filtered = useMemo(() => {
    return data.txs.filter((t) => {
      if (filter.type !== 'all' && t.type !== filter.type) return false;
      if (filter.month !== 'all' && t.date.slice(0, 7) !== filter.month) return false;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        const note = t.note?.toLowerCase() || '';
        const cat = t.category?.toLowerCase() || '';
        if (!note.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });
  }, [data.txs, filter]);

  const stats = useMemo(() => {
    const income = filtered
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const expense = filtered
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filtered]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hematwoi-data.json';
    a.click();
  };

  const importJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          setData({
            txs: parsed.txs || [],
            cat: parsed.cat || defaultCategories,
            budgets: parsed.budgets || [],
          });
        } catch {
          alert('File tidak valid');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const importCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const lines = ev.target.result.split(/\r?\n/).filter(Boolean);
        const txs = lines.map((line) => {
          const [date, type, category, note, amount] = line.split(',');
          return {
            id: uid(),
            date,
            type,
            category,
            note,
            amount: Number(amount),
          };
        });
        setData((d) => ({ ...d, txs: [...txs, ...d.txs] }));
      };
      reader.readAsText(file);
    };
    input.click();
  };

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
            onExport={exportData}
            onImportJSON={importJSON}
            onImportCSV={importCSV}
            onManageCat={() => setShowCat(true)}
          />
        </div>
        <BudgetSection
          filterMonth={filter.month === 'all' ? currentMonth : filter.month}
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

