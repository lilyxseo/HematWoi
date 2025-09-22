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
import EmptyState from "./EmptyState";

export default function TxTable({ items = [], onRemove, onUpdate, loading }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() =>
    Number(localStorage.getItem("tx_page_size")) || 10
  );
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, items.length);
  const pageItems = items.slice(start - 1, end);
  const density = window.__hw_prefs?.density || "comfortable";

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  useEffect(() => {
    localStorage.setItem("tx_page_size", pageSize);
  }, [pageSize]);

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

  if (loading) {
    return (
      <div className="table-wrap overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-1">
            <tr className="text-left">
              <th className="p-2">Kategori</th>
              <th className="p-2">Tanggal</th>
              <th className="p-2">Catatan</th>
              <th className="p-2">Akun</th>
              <th className="p-2">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="even:bg-surface-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="p-2">
                    <div className="h-4 w-full rounded bg-surface-alt" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState onAdd={() => {}} />;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <CategoryDock />
      <div className="table-wrap overflow-auto">
        <table className={`min-w-full text-sm ${density === "compact" ? "table-compact" : ""}`}>
          <thead className="bg-surface-1 sticky top-0 z-10">
            <tr className="text-left">
              <th className="p-2">Kategori</th>
              <th className="p-2">Tanggal</th>
              <th className="p-2">Catatan</th>
              <th className="p-2">Akun</th>
              <th className="p-2 text-right">Jumlah</th>
              <th className="p-2 sticky right-0 bg-surface-1" />
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
        <div className="mt-2 flex items-center justify-between text-sm">
          <div>
            Menampilkan {start}-{end} dari {items.length}
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border px-2 py-1"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
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
