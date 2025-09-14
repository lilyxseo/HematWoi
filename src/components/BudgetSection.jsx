import { useEffect, useMemo, useState } from "react";

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" });

export default function BudgetSection({ filterMonth, budgets, txs, categories, onAdd, onRemove }) {
  const [form, setForm] = useState({
    month: filterMonth,
    category: categories.expense[0] || "Lainnya",
    limit: "",
  });

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
    if (!form.month || !form.category || isNaN(lim) || lim <= 0) {
      return alert("Isi budget dengan benar");
    }
    onAdd({ month: form.month, category: form.category, limit: lim });
    setForm((f) => ({ ...f, limit: "" }));
  };

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div>
        <form onSubmit={submit} className="grid grid-cols-3 gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Bulan</label>
            <input
              className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              placeholder="YYYY-MM"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Kategori</label>
            <select
              className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
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
              <input
                className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
                type="number"
                inputMode="decimal"
                value={form.limit}
                onChange={(e) => setForm({ ...form, limit: e.target.value })}
              />
            </div>
            <button className="btn btn-primary self-end">Tambah</button>
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
                    className={`h-2 bg-indigo-50 rounded-full overflow-hidden border border-slate-200 mt-1 mb-1 ${
                      isOver ? "outline outline-2 outline-red-300" : ""
                    }`}
                  >
                    <div className="h-full bg-gradient-to-r from-sky-500 to-blue-300" style={{ width: pct + "%" }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{pct}% terpakai</span>
                    <button
                      className="btn border-red-500 text-red-500 hover:bg-red-50 px-2 py-1 text-xs"
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
