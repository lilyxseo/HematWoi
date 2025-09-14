import { useState, useMemo, useEffect } from "react";
import { useToast } from "../context/ToastContext";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
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
    category: "",
    month: filterMonth || "",
    amount: "",
  });

  const { addToast } = useToast();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.category || !form.month || !form.amount) return;
    onAdd({
      category: form.category,
      month: form.month,
      amount: Number(form.amount),
    });
    setForm({ category: "", month: filterMonth || "", amount: "" });
  };

  // Budgets untuk bulan terpilih
  const list = budgets.filter((b) => b.month === filterMonth);

  // Akumulasi pengeluaran per kategori untuk bulan terpilih
  const spentByCat = useMemo(() => {
    const map = {};
    txs.forEach((t) => {
      // Asumsi field transaksi: { type, category, date, amount }
      if (!t?.date || !t?.type) return;
      const m = String(t.date).slice(0, 7);
      if (t.type === "expense" && m === filterMonth) {
        const key = t.category || "";
        map[key] = (map[key] || 0) + Number(t.amount || 0);
      }
    });
    return map;
  }, [txs, filterMonth]);

  useEffect(() => {
    list.forEach((b) => {
      const used = Number(spentByCat[b.category] || 0);
      const cap = Number(b.amount || 0);
      const pct = cap <= 0 ? 0 : Math.min(100, Math.round((used / cap) * 100));
      if (pct >= 80) {
        const key = `hw:budget-toast:${filterMonth}:${b.category}`;
        if (!sessionStorage.getItem(key)) {
          addToast(`Budget ${b.category} sudah ${pct}% terpakai bulan ini.`, 'warning');
          sessionStorage.setItem(key, '1');
        }
      }
    });
  }, [list, spentByCat, filterMonth, addToast]);

  return (
    <div className="space-y-4">
      {/* Form tambah budget */}
      <div className="card">
        <h2 className="font-semibold mb-2">Tambah Budget</h2>
        <form onSubmit={submit} className="grid sm:grid-cols-4 gap-3">
          <select
            name="category"
            className="input"
            value={form.category}
            onChange={handleChange}
          >
            <option value="">Pilih kategori (pengeluaran)</option>
            {(categories?.expense || []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            type="month"
            name="month"
            className="input"
            value={form.month}
            onChange={handleChange}
          />

          <input
            type="number"
            name="amount"
            placeholder="Jumlah"
            className="input"
            value={form.amount}
            onChange={handleChange}
            min="0"
            step="1000"
          />

          <button type="submit" className="btn btn-primary">
            Tambah Budget
          </button>
        </form>
      </div>

      {/* Daftar budget bulan terpilih */}
      <div className="card">
        <h2 className="font-semibold mb-2">Daftar Budget</h2>

        {!list.length && (
          <div className="text-sm text-slate-500">
            Belum ada budget bulan ini.
          </div>
        )}

        <ul className="space-y-3">
          {list.map((b) => {
            const used = Number(spentByCat[b.category] || 0);
            const cap = Number(b.amount || 0);
            const pct =
              cap <= 0 ? 0 : Math.min(100, Math.round((used / cap) * 100));

            return (
              <li key={b.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="badge">{b.category}</span>
                  <span>
                    {toRupiah(used)} / {toRupiah(cap)}
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-brand"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <button
                  type="button"
                  className="btn mt-1"
                  onClick={() => onRemove(b.id)}
                >
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
