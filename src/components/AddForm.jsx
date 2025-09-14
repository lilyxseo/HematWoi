import { useState } from 'react';

export default function AddForm({ categories, onAdd }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');

  const catList = categories?.[type] || [];

  const submit = (e) => {
    e.preventDefault();
    onAdd({ date, type, category, note, amount: Number(amount) });
    setNote('');
    setAmount('');
  };

  return (
    <form onSubmit={submit} className="card flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          className="w-full rounded-lg border px-3 py-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select
          className="w-full sm:w-auto rounded-lg border px-3 py-2"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setCategory('');
          }}
        >
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
        </select>
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Kategori</option>
          {catList.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        placeholder="Catatan"
        className="w-full rounded-lg border px-3 py-2"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder="Jumlah"
          className="w-full rounded-lg border px-3 py-2"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className="btn bg-brand border-brand text-white" type="submit">
          Tambah
        </button>
      </div>
    </form>
  );
}
