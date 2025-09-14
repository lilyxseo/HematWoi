import { useEffect, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);

export default function AddForm({ categories, onAdd }) {
  const [form, setForm] = useState({
    date: today(),
    type: "expense",
    category: categories.expense[0] || "Lainnya",
    note: "",
    amount: "",
  });

  useEffect(() => {
    const list = form.type === "income" ? categories.income : categories.expense;
    if (!list.includes(form.category)) {
      setForm((f) => ({ ...f, category: list[0] || "Lainnya" }));
    }
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
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Tipe</label>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20">
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Kategori</label>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20">
          {(form.type === "income" ? categories.income : categories.expense).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Catatan</label>
        <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="opsional" className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" />
      </div>
      <div className="md:col-span-1 flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">Jumlah</label>
          <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20" />
        </div>
        <button type="submit" className="btn btn-primary self-end">Tambah</button>
      </div>
    </form>
  );
}
