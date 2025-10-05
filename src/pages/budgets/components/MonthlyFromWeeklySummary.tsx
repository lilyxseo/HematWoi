import clsx from 'clsx';
import { formatCurrency } from '../../../lib/format';
import type { WeeklyBudgetCategorySummary } from '../../../lib/budgetApi';

interface MonthlyFromWeeklySummaryProps {
  summary: WeeklyBudgetCategorySummary[];
  loading?: boolean;
}

function getProgressColor(percentage: number): string {
  if (percentage <= 0) return 'var(--accent)';
  if (percentage <= 0.74) return 'var(--accent)';
  if (percentage <= 0.89) return '#f59e0b';
  if (percentage <= 1) return '#fb923c';
  return '#f43f5e';
}

function SummarySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-surface/60 p-4 shadow-inner"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded-full bg-muted/30" />
            <div className="h-2 rounded-full bg-muted/20" />
          </div>
          <div className="h-6 w-24 rounded-full bg-muted/30" />
        </div>
      ))}
    </div>
  );
}

export default function MonthlyFromWeeklySummary({ summary, loading }: MonthlyFromWeeklySummaryProps) {
  if (loading) {
    return <SummarySkeleton />;
  }

  if (!summary.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-surface/70 p-6 text-sm text-muted shadow-inner">
        Belum ada data mingguan untuk dirangkum.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {summary.map((item) => {
        const progress = Math.max(0, Math.min(1.5, item.percentage));
        const color = getProgressColor(progress);
        const typeClass = item.category_type === 'income'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-300';

        return (
          <article
            key={item.category_id}
            className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface/70 p-4 shadow-inner md:flex-row md:items-center md:justify-between"
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-text dark:text-white">{item.category_name}</h4>
                <span
                  className={clsx(
                    'inline-flex items-center rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide',
                    typeClass
                  )}
                >
                  Mingguan
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                <span>Rencana {formatCurrency(item.planned, 'IDR')}</span>
                <span>Realisasi {formatCurrency(item.spent, 'IDR')}</span>
                <span>Sisa {formatCurrency(item.remaining, 'IDR')}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20 dark:bg-muted/30">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, progress * 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold text-text dark:text-white">
              <span>{Math.round(progress * 100)}%</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

