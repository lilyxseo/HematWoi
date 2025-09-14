import { useEffect, useState } from "react";

export default function ManageCategories({ cat, onSave }) {
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
      alert("Gagal menyimpan: " + e.message);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Pemasukan</label>
        <textarea
          className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
          rows={8}
          value={income}
          onChange={(e) => setIncome(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Pengeluaran</label>
        <textarea
          className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
          rows={8}
          value={expense}
          onChange={(e) => setExpense(e.target.value)}
        />
      </div>
      <div className="md:col-span-2 text-right">
        <button className="btn btn-primary" onClick={save}>
          Simpan Kategori
        </button>
      </div>
    </div>
  );
}
