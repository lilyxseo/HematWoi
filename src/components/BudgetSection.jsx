import { useState, useMemo } from 'react';

function toRupiah(n = 0) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function BudgetSection({ filterMonth, budgets = [], txs = [], categories, onAdd, onRemove }) {
  const [form, setForm] = useState({ category: '', month: filterMonth || '', amount: '' });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.category || !form.month || !form.amount) return;
    onAdd({ category: form.category, month: form.month, amount: Number(form.amount) });
    setForm({ category: '', month: filterMonth || '', amount: '' });
  };

  const list = budgets.filter((b) => b.month === filterMonth);

  const spentByCat = useMemo(() => {
    const map = {};
    txs.forEach((t) => {
      const m = t.date.slice(0, 7);
      if (t.type === 'expense' && m === filterMonth) {
        map[t.category] = (map[t.category] || 0) + t.amount;
      }
    });
    return map;
  }, [txs, filterMonth]);

  return (
    <div className="card">
      <h2 className="font-semibold mb-2">Anggaran</h2>
      <form onSubmit={submit} className="flex flex-wrap gap-2 mb-4">
        <select
          name="category"
          className="rounded-lg border px-3 py-2"
          value={form.category}
          onChange={handleChange}
        >
          <option value="">Kategori</option>
          {(categories?.expense || []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="month"
          name="month"
          className="rounded-lg border px-3 py-2"
          value={form.month}
          onChange={handleChange}
        />
        <input
          type="number"
          name="amount"
          placeholder="Jumlah"
          className="w-32 rounded-lg border px-3 py-2"
          value={form.amount}
          onChange={handleChange}
        />
        <button className="btn bg-brand border-brand text-white" type="submit">
          Tambah
        </button>
      </form>
      <ul className="space-y-2">
        {list.map((b) => {
          const used = spentByCat[b.category] || 0;
          const pct = Math.min(100, Math.round((used / b.amount) * 100));
          return (
            <li key={b.id} className="border rounded-lg p-2">
              <div className="flex justify-between mb-1 text-sm">
                <span>{b.category}</span>
                <span>
                  {toRupiah(used)} / {toRupiah(b.amount)}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded">
                <div
                  className="h-full bg-brand rounded"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <button className="btn mt-2" onClick={() => onRemove(b.id)}>
                Hapus
              </button>
            </li>
          );
        })}
        {!list.length && (
          <li className="text-sm text-gray-500">Belum ada anggaran bulan ini.</li>
        )}
      </ul>
    </div>
  );
}
