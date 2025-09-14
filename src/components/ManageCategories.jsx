import { useState } from 'react';

export default function ManageCategories({ cat, onSave }) {
  const [income, setIncome] = useState((cat?.income || []).join('\n'));
  const [expense, setExpense] = useState((cat?.expense || []).join('\n'));

  const save = () => {
    const parse = (str) =>
      str
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    onSave({ income: parse(income), expense: parse(expense) });
  };

  return (
    <div className="card">
      <h2 className="font-semibold mb-2">Kelola Kategori</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <h3 className="mb-1 text-sm font-medium">Pemasukan</h3>
          <textarea
            className="w-full h-40 rounded-lg border px-3 py-2"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium">Pengeluaran</h3>
          <textarea
            className="w-full h-40 rounded-lg border px-3 py-2"
            value={expense}
            onChange={(e) => setExpense(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4">
        <button className="btn bg-brand border-brand text-white" onClick={save}>
          Simpan
        </button>
      </div>
    </div>
  );
}
