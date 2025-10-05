import clsx from 'clsx';
import { formatCurrency } from '../../../lib/format';
import type { WeeklyBudgetSummaryRow } from '../../../lib/budgetApi';

interface MonthlyFromWeeklySummaryProps {
  rows: WeeklyBudgetSummaryRow[];
  loading?: boolean;
}

function getProgressColor(percentage: number) {
  if (percentage > 1) return 'bg-rose-500';
  if (percentage >= 0.9) return 'bg-orange-500';
  if (percentage >= 0.75) return 'bg-amber-500';
  return 'bg-[color:var(--accent)]';
}

function getTrackColor(percentage: number) {
  if (percentage > 1) return 'bg-rose-500/15';
  if (percentage >= 0.9) return 'bg-orange-500/15';
  if (percentage >= 0.75) return 'bg-amber-500/15';
  return 'bg-[color:var(--accent)]/15';
}

export default function MonthlyFromWeeklySummary({ rows, loading }: MonthlyFromWeeklySummaryProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-2xl border border-dashed border-border/60 bg-surface/70" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-surface/70 p-6 text-sm text-muted">
        Belum ada anggaran mingguan untuk bulan ini. Tambahkan agar progres bulanannya dapat dipantau.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const planned = Number(row.planned ?? 0);
        const actual = Number(row.actual ?? 0);
        const percentage = planned > 0 ? actual / planned : 0;
        const progress = Math.min(Math.max(percentage, 0), 1);
        const progressColor = getProgressColor(percentage);
        const trackColor = getTrackColor(percentage);
        const remaining = planned - actual;
        const remainingClass = remaining < 0 ? 'text-rose-500 dark:text-rose-300' : 'text-muted';
        return (
          <article
            key={row.category_id}
            className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-sm supports-[backdrop-filter]:bg-surface/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-text dark:text-white">{row.category_name}</h4>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="font-semibold text-text">{formatCurrency(actual, 'IDR')}</span>
                <span>/</span>
                <span>{formatCurrency(planned, 'IDR')}</span>
                <span className={remainingClass}>{formatCurrency(remaining, 'IDR')}</span>
              </div>
            </div>
            <div className={clsx('h-2 w-full overflow-hidden rounded-full', trackColor)}>
              <div className={clsx('h-full rounded-full transition-all', progressColor)} style={{ width: `${progress * 100}%` }} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
