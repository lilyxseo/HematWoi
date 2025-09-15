import { useEffect, useState } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import CategoryDock from "./CategoryDock";
import Row from "./Row";

export default function TxTable({ items = [], onRemove, onUpdate }) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, items.length);
  const pageItems = items.slice(start - 1, end);
  const density = window.__hw_prefs?.density || "comfortable";

  useEffect(() => {
    setPage(1);
  }, [items]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active && active.id && over.id) {
      onUpdate(active.id, { category: over.id });
    }
  };

  if (items.length === 0) return null;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <CategoryDock />
      <div className="table-wrap">
        <table className={density === "compact" ? "table-compact" : ""}>
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Tanggal</th>
              <th>Catatan</th>
              <th style={{ textAlign: "right" }}>Jumlah</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => (
              <Row
                key={item.id}
                item={item}
                onRemove={onRemove}
                onUpdate={onUpdate}
              />
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--fs-400)" }}>
          <div>
            Menampilkan {start}-{end} dari {items.length}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Sebelumnya
            </button>
            <button
              className="btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
    </DndContext>
  );
}
