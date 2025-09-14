import { useEffect, useState } from "react";

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" });

export default function Row({ t, onRemove, onUpdate }) {
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
            className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
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
            className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
          </select>
        ) : (
          <span
            className={`badge ${
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
            className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
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
            className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
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
            className="input focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20"
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
            <button className="btn btn-primary" onClick={save}>Simpan</button>
            <button
              className="btn"
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
            <button className="btn" onClick={() => setEdit(true)}>
              Edit
            </button>
            <button
              className="btn border-red-500 text-red-500 hover:bg-red-50"
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
