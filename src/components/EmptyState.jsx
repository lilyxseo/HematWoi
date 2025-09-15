import { Plus } from "lucide-react";

export default function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="text-muted">Belum ada transaksi</div>
      <button className="btn btn-primary flex items-center gap-1" onClick={onAdd}>
        <Plus className="h-4 w-4" /> Tambah Transaksi
      </button>
    </div>
  );
}
