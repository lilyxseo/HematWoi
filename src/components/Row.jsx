import { useContext, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
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

  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.id });

  const [swipe, setSwipe] = useState(0);
  const [startX, setStartX] = useState(null);

  const handlePointerDown = (e) => {
    if (window.innerWidth >= 768) return;
    setStartX(e.clientX);
  };
  const handlePointerMove = (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    setSwipe(dx);
  };
  const handlePointerUp = () => {
    if (startX === null) return;
    const threshold = 50;
    if (swipe < -threshold) setSwipe(-80);
    else if (swipe > threshold) setSwipe(80);
    else setSwipe(0);
    setStartX(null);
  };
  const resetSwipe = () => setSwipe(0);

  const save = () => {
    onUpdate(item.id, { note, amount: Number(amount) });
    setEdit(false);
  };

  return (
    <tr
      className="relative"
      style={{
        transform: `translateX(${swipe}px)`,
        transition: startX !== null ? "none" : "transform 0.2s",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
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
      <td className="p-2 text-right hidden md:table-cell">
        {edit ? (
          <div className="flex gap-1 justify-end">
            <button className="btn btn-primary" onClick={save}>
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
      <td className="absolute inset-y-0 left-0 flex items-center pl-2 md:hidden">
        {edit ? (
          <button
            className="btn"
            onClick={() => {
              setEdit(false);
              resetSwipe();
            }}
          >
            Batal
          </button>
        ) : (
          <button
            className="btn"
            onClick={() => {
              setEdit(true);
              resetSwipe();
            }}
          >
            Edit
          </button>
        )}
      </td>
      <td className="absolute inset-y-0 right-0 flex items-center pr-2 md:hidden">
        <button
          className="btn bg-red-500 text-white"
          onClick={() => {
            onRemove(item.id);
            resetSwipe();
          }}
        >
          Hapus
        </button>
      </td>
    </tr>
  );
}
