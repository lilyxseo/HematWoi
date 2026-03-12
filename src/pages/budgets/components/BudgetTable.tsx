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
  'grid grid-cols-1 gap-4 md:gap-5 lg:[grid-template-columns:repeat(auto-fit,minmax(310px,1fr))]';

function LoadingCards() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="min-h-[300px] animate-pulse rounded-3xl border border-white/10 bg-zinc-900/60 p-5"
        >
          <div className="h-5 w-1/2 rounded bg-white/10" />
          <div className="mt-3 h-3 w-2/3 rounded bg-white/5" />
          <div className="mt-6 h-10 w-2/3 rounded bg-white/10" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="h-14 rounded-2xl bg-white/5" />
            <div className="h-14 rounded-2xl bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-zinc-900/45 p-10 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-4 text-base font-semibold text-zinc-100">Belum ada budget</p>
      <p className="mt-1 text-sm text-zinc-400">Mulai dengan membuat budget pertama agar pengeluaran lebih terkontrol.</p>
    </div>
  );
}

export default function BudgetTable({
  rows,
  loading,
  highlightedIds,
  onEdit,
  onDelete,
  onToggleCarryover,
  onViewTransactions,
  onToggleHighlight,
}: BudgetTableProps) {
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
