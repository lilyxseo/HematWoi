import { Sparkles } from 'lucide-react';
import type { BudgetWithSpent } from '../../../lib/budgetApi';
import BudgetCard from './BudgetCard';

interface BudgetTableProps {
  rows: BudgetWithSpent[];
  loading?: boolean;
  highlightedIds?: Set<string>;
  onEdit: (row: BudgetWithSpent) => void;
  onDelete: (row: BudgetWithSpent) => void;
  onToggleCarryover: (row: BudgetWithSpent, carryover: boolean) => void;
  onViewTransactions: (row: BudgetWithSpent) => void;
  onToggleHighlight: (row: BudgetWithSpent) => void;
}

const GRID_CLASS =
  'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

function LoadingCards() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-[320px] animate-pulse rounded-3xl border border-white/10 bg-zinc-950/70" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-950/70 p-10 text-center">
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Sparkles className="h-4 w-4" />
      </span>
      <p className="text-sm font-semibold text-zinc-100">Belum ada budget</p>
      <p className="mt-1 text-sm text-zinc-400">Mulai dengan membuat budget untuk satu atau beberapa kategori.</p>
    </div>
  );
}

export default function BudgetTable({ rows, loading, highlightedIds, onEdit, onDelete, onToggleCarryover, onViewTransactions, onToggleHighlight }: BudgetTableProps) {
  if (loading) return <LoadingCards />;
  if (rows.length === 0) return <EmptyState />;

  const highlightSet = highlightedIds ?? new Set<string>();

  return (
    <div className={GRID_CLASS}>
      {rows.map((row) => (
        <BudgetCard
          key={row.id}
          budget={row}
          isHighlighted={highlightSet.has(String(row.id))}
          onViewTransactions={() => onViewTransactions(row)}
          onToggleHighlight={() => onToggleHighlight(row)}
          onToggleCarryover={(carryover) => onToggleCarryover(row, carryover)}
          onEdit={() => onEdit(row)}
          onDelete={() => onDelete(row)}
        />
      ))}
    </div>
  );
}
