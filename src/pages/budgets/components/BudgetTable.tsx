import { Sparkles } from 'lucide-react';
import type { BudgetWithSpent } from '../../../lib/budgetApi';
import BudgetCard from './BudgetCard';

interface BudgetTableProps {
  rows: BudgetWithSpent[];
  loading?: boolean;
  highlightedIds?: Set<string>;
  highlightLimitReached?: boolean;
  onEdit: (row: BudgetWithSpent) => void;
  onDelete: (row: BudgetWithSpent) => void;
  onToggleCarryover: (row: BudgetWithSpent, carryover: boolean) => void;
  onViewTransactions: (row: BudgetWithSpent) => void;
  onToggleHighlight: (row: BudgetWithSpent) => void;
}

const GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6 lg:[grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] xl:[grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]';

function LoadingCards() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="grid min-h-[280px] md:min-h-[300px] grid-rows-[auto,auto,1fr,auto] gap-3 rounded-2xl border border-dashed border-white/10 bg-surface/40 p-4 shadow-sm backdrop-blur md:p-5 xl:p-6"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-muted/20" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded-full bg-muted/20" />
              <div className="h-3 w-1/2 rounded-full bg-muted/10" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-2/3 rounded-full bg-muted/15" />
            <div className="h-3 w-1/3 rounded-full bg-muted/10" />
          </div>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="h-12 rounded-xl bg-muted/15" />
              <div className="h-12 rounded-xl bg-muted/15" />
              <div className="h-12 rounded-xl bg-muted/15" />
            </div>
            <div className="h-2 rounded-full bg-muted/15" />
          </div>
          <div className="flex justify-end gap-2">
            <div className="h-10 w-10 rounded-xl bg-muted/15" />
            <div className="h-10 w-10 rounded-xl bg-muted/15" />
            <div className="h-10 w-10 rounded-xl bg-muted/15" />
            <div className="h-10 w-10 rounded-xl bg-muted/15" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-surface/60 p-8 text-center text-sm text-muted-foreground shadow-inner backdrop-blur">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text">Belum ada anggaran</p>
        <p className="text-sm text-muted-foreground">
          Tambahkan kategori anggaran untuk mulai mengontrol pengeluaranmu.
        </p>
      </div>
    </div>
  );
}

export default function BudgetTable({
  rows,
  loading,
  highlightedIds,
  highlightLimitReached,
  onEdit,
  onDelete,
  onToggleCarryover,
  onViewTransactions,
  onToggleHighlight,
}: BudgetTableProps) {
  if (loading) {
    return <LoadingCards />;
  }

  if (rows.length === 0) {
    return <EmptyState />;
  }

  const highlightSet = highlightedIds ?? new Set<string>();
  const limitReached = Boolean(highlightLimitReached);

  return (
    <div className={GRID_CLASS}>
      {rows.map((row) => {
        const isHighlighted = highlightSet.has(String(row.id));
        const disableHighlight = !isHighlighted && limitReached;

        return (
          <BudgetCard
            key={row.id}
            budget={row}
            isHighlighted={isHighlighted}
            disableHighlight={disableHighlight}
            onViewTransactions={() => onViewTransactions(row)}
            onToggleHighlight={() => onToggleHighlight(row)}
            onToggleCarryover={(carryover) => onToggleCarryover(row, carryover)}
            onEdit={() => onEdit(row)}
            onDelete={() => onDelete(row)}
          />
        );
      })}
    </div>
  );
}
