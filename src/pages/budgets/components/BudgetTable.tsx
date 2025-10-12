import { Sparkles } from 'lucide-react';
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
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] lg:gap-6 xl:[grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]';

function LoadingState() {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="min-h-[280px] animate-pulse rounded-2xl border border-white/10 bg-surface/40 p-4 shadow-sm backdrop-blur md:min-h-[300px] md:p-5 xl:p-6"
        >
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-muted/15" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded-full bg-muted/20" />
                <div className="h-3 w-1/2 rounded-full bg-muted/10" />
              </div>
            </div>
            <div className="h-3 w-2/3 rounded-full bg-muted/10" />
            <div className="flex-1 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="h-12 rounded-xl bg-muted/10" />
                <div className="h-12 rounded-xl bg-muted/10" />
                <div className="h-12 rounded-xl bg-muted/10" />
              </div>
              <div className="h-2 rounded-full bg-muted/10" />
            </div>
            <div className="mt-auto flex items-center justify-end gap-2">
              {Array.from({ length: 4 }).map((__, actionIndex) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={actionIndex}
                  className="h-10 w-10 rounded-xl bg-muted/10"
                />
              ))}
            </div>
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
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Belum ada anggaran</p>
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
    return <LoadingState />;
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
            row={row}
            highlighted={isHighlighted}
            disableHighlight={disableHighlight}
            onToggleCarryover={(carryover) => onToggleCarryover(row, carryover)}
            onViewTransactions={() => onViewTransactions(row)}
            onToggleHighlight={() => onToggleHighlight(row)}
            onEdit={() => onEdit(row)}
            onDelete={() => onDelete(row)}
          />
        );
      })}
    </div>
  );
}
