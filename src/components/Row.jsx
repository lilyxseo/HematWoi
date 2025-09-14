import { useContext, useState } from "react";
import { CategoryContext } from "../context/CategoryContext";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function Row({ item, onRemove, onUpdate }) {
  const [edit, setEdit] = useState(false);
  const [note, setNote] = useState(item.note || "");
  const [amount, setAmount] = useState(item.amount);
  const { getColor } = useContext(CategoryContext);

  const save = () => {
    onUpdate(item.id, { note, amount: Number(amount) });
    setEdit(false);
  };

  return (
    <tr>
      <td className="p-2">
        {item.category && (
          <span
            className="badge"
            style={{
              backgroundColor: getColor(item.category),
              color: "white",
              borderColor: "transparent",
            }}
          >
            {item.category}
          </span>
        )}
      </td>
      <td className="p-2">{item.date}</td>
      <td className="p-2">
        {edit ? (
          <input
            className="w-full rounded-lg border px-2 py-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        ) : (
          item.note || "-"
        )}
      </td>
      <td
        className={`p-2 text-right ${
          item.type === "income" ? "text-green-600" : "text-red-600"
        }`}
      >
        {edit ? (
          <input
            type="number"
            className="w-24 rounded-lg border px-2 py-1 text-right"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        ) : (
          toRupiah(item.amount)
        )}
      </td>
      <td className="p-2 text-right">
        {edit ? (
          <div className="flex gap-1 justify-end">
            <button className="btn bg-brand border-brand text-white" onClick={save}>
              Simpan
            </button>
            <button className="btn" onClick={() => setEdit(false)}>
              Batal
            </button>
          </div>
        ) : (
          <div className="flex gap-1 justify-end">
            <button className="btn" onClick={() => setEdit(true)}>
              Edit
            </button>
            <button className="btn" onClick={() => onRemove(item.id)}>
              Hapus
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
