import { useContext, useEffect, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CategoryContext } from "../context/CategoryContext";

function toNumber(str = "") {
  return Number(str.replace(/\./g, ""));
}

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
  const [amount, setAmount] = useState(item.amount.toString());
  const noteRef = useRef(null);
  const amountRef = useRef(null);
  const { getColor } = useContext(CategoryContext);

  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.id });

  useEffect(() => {
    if (edit && noteRef.current) noteRef.current.focus();
  }, [edit]);

  const save = () => {
    onUpdate(item.id, { note, amount: toNumber(amount) });
    setEdit(false);
  };

  const cancel = () => {
    setEdit(false);
    setNote(item.note || "");
    setAmount(item.amount.toString());
  };

  const handleAmountChange = (e) => {
    const v = e.target.value.replace(/[^0-9-]/g, "");
    setAmount(v);
  };

  const handleAmountBlur = () => {
    setAmount(toNumber(amount).toLocaleString("id-ID"));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  return (
    <tr className={`even:bg-surface-1 hover:bg-surface-2 ${edit ? "bg-surface-1" : ""}`}>
      <td className="p-2">
        {item.category && (
          <span
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className="badge cursor-grab active:cursor-grabbing"
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
      <td className="p-2 whitespace-nowrap">{item.date}</td>
      <td className="p-2 max-w-[200px] truncate" title={item.note || "-"}>
        {edit ? (
          <input
            ref={noteRef}
            className="w-full rounded-md border px-2 py-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        ) : (
          item.note || "-"
        )}
      </td>
      <td className="p-2">{item.account || "-"}</td>
      <td className="p-2">
        {item.tags?.length
          ? item.tags.map((tag) => (
              <span
                key={tag}
                className="mr-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))
          : "-"}
      </td>
      <td
        className={`p-2 text-right tabular-nums ${
          item.type === "income" ? "text-success" : "text-danger"
        }`}
      >
        {edit ? (
          <div className="relative w-32">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted">
              Rp
            </span>
            <input
              ref={amountRef}
              type="text"
              inputMode="numeric"
              className="w-full rounded-md border pl-6 pr-2 py-1 text-right"
              value={amount}
              onChange={handleAmountChange}
              onBlur={handleAmountBlur}
              onKeyDown={handleKeyDown}
            />
          </div>
        ) : (
          toRupiah(item.amount)
        )}
      </td>
      <td className="sticky right-0 bg-surface-1 p-2">
        {edit ? (
          <div className="flex justify-end gap-1">
            <button className="btn btn-primary btn-sm" onClick={save}>
              Simpan
            </button>
            <button className="btn btn-sm" onClick={cancel}>
              Batal
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-1">
            <button className="btn btn-sm" onClick={() => setEdit(true)}>
              Edit
            </button>
            <button className="btn btn-sm" onClick={() => onRemove(item.id)}>
              Hapus
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
