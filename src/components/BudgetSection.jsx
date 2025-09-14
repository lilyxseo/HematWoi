import { useState, useMemo } from 'react';

function toRupiah(n = 0) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function BudgetSection({
  filterMonth,
  budgets = [],
  txs = [],
  categories,
  onAdd,
  onRemove,
}) {
  const [form, setForm] = useState({
    category: '',
    month: filterMonth || '',
    amount: '',
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.category || !form.month || !form.amount) return;
    onAdd({
      category: form.category,
      month: form.month,
      amount: Number(form.amount),
    });
    setForm({ category: '', month: filterMonth || '', amount: '' });
  };

  const list = budgets.filter((b) => b.month === filterMonth);

  const usedMap = useMemo(() => {
    const map = {};
    txs.forEach((t) => {
      if (
        t.type === 'expense' &&
        t.category &&
        t.date.slice(0, 7) === filterMonth
      ) {
        map[t.category] = (map[t.category] || 0) + t.amount;
      }
    });
    return map;
  }, [txs, filterMonth]);

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold mb-2">Tambah Budget</h2>
        <form onSubmit={submit} className="grid sm:grid-cols-4 gap-3">
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
            className="rounded-lg border px-3 py-2"
            value={form.amount}
            onChange={handleChange}
          />
          <button className="btn btn-primary" type="submit">
            Tambah Budget
          </button>
        </form>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-2">Daftar Budget</h2>
        {!list.length && (
          <div className="text-sm text-slate-500">
            Belum ada budget bulan ini.
          </div>
        )}
        <ul className="space-y-3">
          {list.map((b) => {
            const used = usedMap[b.category] || 0;
            const pct = Math.min(100, Math.round((used / b.amount) * 100));
            return (
              <li key={b.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="badge">{b.category}</span>
                  <span>
                    {toRupiah(used)} / {toRupiah(b.amount)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-brand"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <button className="btn mt-1" onClick={() => onRemove(b.id)}>
                  Hapus
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
