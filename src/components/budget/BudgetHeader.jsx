import PageHeader from "../../layout/PageHeader";
import {
  IconPlus as Plus,
  IconList as List,
  IconLayoutGrid as LayoutGrid
} from '@tabler/icons-react';
import { formatCurrency } from "../../lib/format";

export default function BudgetHeader({ totals, view, setView }) {
  const toggleView = () => {
    const next = view === "grid" ? "table" : "grid";
    setView(next);
    try {
      localStorage.setItem("budget:view", next);
    } catch {
      // ignore
    }
  };

  return (
    <PageHeader title="Anggaran" description="Kelola anggaran bulanan">
      <span className="hidden items-center gap-1 sm:flex">
        <span className="rounded-full bg-surface-2 px-2 py-1 text-xs">
          {formatCurrency(totals.planned)} · {formatCurrency(totals.actual)} · {formatCurrency(totals.remaining)}
        </span>
      </span>
      <div className="flex gap-2">
        <button className="btn btn-primary flex items-center gap-1">
          <Plus className="h-4 w-4" /> Tambah
        </button>
        <button
          type="button"
          className="btn flex items-center gap-1"
          onClick={toggleView}
        >
          {view === "grid" ? (
            <List className="h-4 w-4" />
          ) : (
            <LayoutGrid className="h-4 w-4" />
          )}
          {view === "grid" ? "Tabel" : "Grid"}
        </button>
      </div>
    </PageHeader>
  );
}
