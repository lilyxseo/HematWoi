import clsx from 'clsx';
import { Eye, Pencil, Star, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../../lib/format';

interface BudgetCardProps {
  name: string;
  categoryType: 'income' | 'expense';
  planned: number;
  actual: number;
  remaining: number;
  percentage: number;
  periodLabel: string;
  badge: 'Bulanan' | 'Mingguan';
  notes?: string | null;
  carryoverEnabled?: boolean;
  onToggleCarryover?: (value: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  highlightSelected: boolean;
  onToggleHighlight: () => void;
  linkToTransactions?: string;
  weekRangeLabel?: string;
}

function getProgressColor(percentage: number) {
  if (percentage > 1) return 'bg-rose-500';
  if (percentage >= 0.9) return 'bg-orange-500';
  if (percentage >= 0.75) return 'bg-amber-500';
  return 'bg-[color:var(--accent)]';
}

function getProgressTrackColor(percentage: number) {
  if (percentage > 1) return 'bg-rose-500/15';
  if (percentage >= 0.9) return 'bg-orange-500/15';
  if (percentage >= 0.75) return 'bg-amber-500/15';
  return 'bg-[color:var(--accent)]/15';
}

function formatPercentage(percentage: number) {
  const pct = Math.max(0, percentage);
  if (pct > 2) {
    return `${(pct * 100).toFixed(0)}%`;
  }
  return `${Math.round(pct * 100)}%`;
}

export function BudgetCard({
  name,
  categoryType,
  planned,
  actual,
  remaining,
  percentage,
  periodLabel,
  badge,
  notes,
  carryoverEnabled,
  onToggleCarryover,
  onEdit,
  onDelete,
  highlightSelected,
  onToggleHighlight,
  linkToTransactions,
  weekRangeLabel,
}: BudgetCardProps) {
  const pct = Math.max(0, percentage);
  const displayPct = Math.min(1, pct);
  const progressColor = getProgressColor(pct);
  const trackColor = getProgressTrackColor(pct);
  const remainingClass = remaining < 0 ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-500 dark:text-emerald-300';
  const badgeClass = categoryType === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-sky-500/10 text-sky-600';

  return (
    <article className="flex flex-col gap-6 rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-lg shadow-black/5 transition hover:-translate-y-1 hover:shadow-xl supports-[backdrop-filter]:bg-surface/60">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            <span className="rounded-full bg-muted/20 px-3 py-1 text-[0.7rem] font-semibold text-muted">{badge}</span>
            <span>{periodLabel}</span>
          </div>
          <h3 className="text-lg font-semibold text-text dark:text-white">{name}</h3>
          {weekRangeLabel ? <p className="text-xs text-muted">{weekRangeLabel}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-border/50',
              badgeClass
            )}
          >
            {categoryType === 'income' ? 'Income' : 'Expense'}
          </span>
          <button
            type="button"
            onClick={onToggleHighlight}
            aria-label={highlightSelected ? 'Hapus dari highlight' : 'Tambahkan ke highlight'}
            className={clsx(
              'inline-flex h-10 w-10 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              highlightSelected
                ? 'border-amber-400 bg-amber-400/20 text-amber-500 dark:border-amber-500 dark:text-amber-300'
                : 'border-border/60 bg-surface/80 text-muted hover:text-text'
            )}
          >
            <Star className={clsx('h-5 w-5', highlightSelected ? 'fill-current' : undefined)} />
          </button>
        </div>
      </header>

      <section className="grid gap-4 text-sm sm:grid-cols-3">
        <div className="space-y-1">
          <span className="text-[0.68rem] uppercase tracking-[0.18em] text-muted">Planned</span>
          <p className="text-base font-semibold text-text">{formatCurrency(planned, 'IDR')}</p>
          <p className="text-xs text-muted">Target minggu/bulan ini</p>
        </div>
        <div className="space-y-1">
          <span className="text-[0.68rem] uppercase tracking-[0.18em] text-muted">Actual</span>
          <p className="text-base font-semibold text-text">{formatCurrency(actual, 'IDR')}</p>
          <p className="text-xs text-muted">{formatPercentage(displayPct)} tercapai</p>
        </div>
        <div className="space-y-1">
          <span className="text-[0.68rem] uppercase tracking-[0.18em] text-muted">Sisa</span>
          <p className={clsx('text-base font-semibold', remainingClass)}>{formatCurrency(remaining, 'IDR')}</p>
          <p className="text-xs text-muted">{remaining < 0 ? 'Melebihi anggaran' : 'Masih tersedia'}</p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <span>Progress</span>
          <span>{formatPercentage(pct)}</span>
        </div>
        <div className={clsx('h-2 w-full overflow-hidden rounded-full', trackColor)}>
          <div className={clsx('h-full rounded-full transition-all', progressColor)} style={{ width: `${Math.min(100, displayPct * 100)}%` }} />
        </div>
      </section>

      {notes ? (
        <p className="rounded-xl border border-dashed border-border/60 bg-surface/70 p-4 text-sm leading-relaxed text-muted">
          {notes}
        </p>
      ) : null}

      <footer className="flex flex-wrap items-center gap-2">
        {typeof carryoverEnabled === 'boolean' && onToggleCarryover ? (
          <button
            type="button"
            onClick={() => onToggleCarryover(!carryoverEnabled)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              carryoverEnabled
                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-600'
                : 'border-border/60 bg-surface/80 text-muted hover:text-text'
            )}
            aria-label={carryoverEnabled ? 'Matikan carryover' : 'Aktifkan carryover'}
          >
            <span className="block h-2 w-2 rounded-full bg-current" />
            Carryover {carryoverEnabled ? 'on' : 'off'}
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {linkToTransactions ? (
            <Link
              to={linkToTransactions}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface/80 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              aria-label="Lihat transaksi"
            >
              <Eye className="h-4 w-4" />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface/80 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="Edit anggaran"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-400/60 bg-rose-500/10 text-rose-500 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
            aria-label="Hapus anggaran"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </article>
  );
}

export function BudgetCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-dashed border-border/60 bg-surface/70 p-5">
      <div className="h-4 w-32 rounded-full bg-muted/30" />
      <div className="mt-4 h-6 w-48 rounded-full bg-muted/30" />
      <div className="mt-6 h-2 w-full rounded-full bg-muted/20" />
      <div className="mt-2 h-2 w-5/6 rounded-full bg-muted/20" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="h-16 rounded-xl bg-muted/10" />
        <div className="h-16 rounded-xl bg-muted/10" />
        <div className="h-16 rounded-xl bg-muted/10" />
      </div>
      <div className="mt-6 flex gap-2">
        <div className="h-10 w-10 rounded-full bg-muted/20" />
        <div className="h-10 w-10 rounded-full bg-muted/20" />
        <div className="h-10 w-10 rounded-full bg-muted/20" />
      </div>
    </div>
  );
}
