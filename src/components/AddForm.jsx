import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Segmented from "./ui/Segmented";
import CurrencyInput from "./ui/CurrencyInput";
import Input from "./ui/Input";
import Select from "./ui/Select";
import Textarea from "./ui/Textarea";
import { useTransactionFormPrefetch } from "../hooks/useTransactionFormPrefetch";

export default function AddForm({ categories, onAdd }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const { prefetchAddForm } = useTransactionFormPrefetch();

  useEffect(() => {
    setCategory(categories[type]?.[0] || "");
  }, [type, categories]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (amount <= 0 || !date || !category) return;
    onAdd({ date, type, category, note, amount });
    setAmount(0);
    setNote("");
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { label: "Pemasukan", value: "income" },
          { label: "Pengeluaran", value: "expense" },
        ]}
      />
      <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
      <Input
        type="date"
        label="Tanggal"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <Select
        label="Kategori"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        options={categories[type] || []}
        placeholder="Pilih"
      />
      <Textarea
        label="Catatan"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex justify-between pt-2">
        <Link
          to="/transaction/add"
          onMouseEnter={prefetchAddForm}
          onTouchStart={prefetchAddForm}
          onClick={prefetchAddForm}
          className="btn"
        >
          Form lengkap
        </Link>
        <button type="submit" className="btn btn-primary">
          Tambah Cepat
        </button>
      </div>
    </form>
  );
}
