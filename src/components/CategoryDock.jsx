import { useContext, useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { CategoryContext } from "../context/CategoryContext";

function Chip({ name }) {
  const { setNodeRef, isOver } = useDroppable({ id: name });
  const { getColor } = useContext(CategoryContext);
  return (
    <span
      ref={setNodeRef}
      className={`badge rounded-full whitespace-nowrap cursor-pointer select-none border border-border bg-surface-1 hover:bg-surface-2 ${
        isOver ? "bg-surface-2" : ""
      }`}
      style={{
        backgroundColor: getColor(name),
        color: "white",
        borderColor: "transparent",
      }}
    >
      {name}
    </span>
  );
}

export default function CategoryDock() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("hematwoi:v3");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setCats(parsed?.cat?.expense || []);
    } catch {
      setCats([]);
    }
  }, []);
  if (cats.length === 0) return null;
  return (
    <div className="flex overflow-x-auto gap-2 pb-2">
      {cats.map((c) => (
        <Chip key={c} name={c} />
      ))}
    </div>
  );
}
