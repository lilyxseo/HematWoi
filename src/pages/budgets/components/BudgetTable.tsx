import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Flame, LineChart, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetWithSpent } from '../../../lib/budgetApi';

interface BudgetTableProps {
  rows: BudgetWithSpent[];
  loading?: boolean;
  onEdit: (row: BudgetWithSpent) => void;
  onDelete: (row: BudgetWithSpent) => void;
  onToggleCarryover: (row: BudgetWithSpent, carryover: boolean) => void;
}

const CARD_WRAPPER_CLASS = 'grid gap-5 md:grid-cols-2 xl:grid-cols-3';

const CARD_CLASS =
  'relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-lg ring-1 ring-inset ring-border/70 transition duration-200 hover:-translate-y-1 hover:shadow-2xl dark:bg-surface-2/80';

const STATUS_CONFIG = {
  danger: {
    label: 'Melebihi batas',
    icon: Flame,
    badgeClass:
      'bg-rose-500/10 text-rose-500 ring-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-300/40',
    halo: 'from-rose-500/20 via-rose-400/10 to-transparent',
    progress: 'from-rose-500 via-rose-400 to-rose-300',
  },
  warning: {
    label: 'Hampir habis',
    icon: AlertTriangle,
    badgeClass:
      'bg-amber-500/10 text-amber-500 ring-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-300/40',
    halo: 'from-amber-500/20 via-amber-400/10 to-transparent',
    progress: 'from-amber-500 via-amber-400 to-amber-300',
  },
  good: {
    label: 'Sehat',
    icon: CheckCircle2,
    badgeClass:
      'bg-emerald-500/10 text-emerald-500 ring-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-300/40',
    halo: 'from-emerald-500/20 via-emerald-400/10 to-transparent',
    progress: 'from-emerald-500 via-emerald-400 to-emerald-300',
  },
} as const;

function LoadingCards() {
  return (
    <div className={clsx(CARD_WRAPPER_CLASS)}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className={clsx(CARD_CLASS, 'animate-pulse')}
        >
          <div className="h-4 w-24 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
          <div className="space-y-3">
            <div className="h-3 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
            <div className="h-3 w-3/4 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
          <div className="space-y-2">
            <div className="h-3 w-1/3 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
            <div className="h-3 w-1/2 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface-1/70 p-10 text-center text-sm text-muted shadow-sm">
      <p className="text-base font-semibold text-text">Belum ada anggaran</p>
      <p className="mt-2 leading-relaxed">
        Mulai tambahkan kategori anggaran untuk memetakan rencana belanja dan memantau sisa dana setiap bulan.
      </p>
    </div>
  );
}

export default function BudgetTable({ rows, loading, onEdit, onDelete, onToggleCarryover }: BudgetTableProps) {
  if (loading) {
    return <LoadingCards />;
  }

  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className={CARD_WRAPPER_CLASS}>
      {rows.map((row) => {
        const planned = Number(row.amount_planned ?? 0);
        const spent = Number(row.spent ?? 0);
        const remaining = Number(row.remaining ?? 0);
        const percentage = planned > 0 ? Math.min(200, Math.round((spent / planned) * 100)) : spent > 0 ? 200 : 0;
        const displayPercentage = Math.min(100, percentage);
        const overBudget = remaining < 0;
        const categoryName = row.category?.name ?? 'Tanpa kategori';
        const categoryInitial = categoryName.trim().charAt(0).toUpperCase() || 'B';
        const statusKey = overBudget ? 'danger' : percentage >= 90 ? 'warning' : 'good';
        const status = STATUS_CONFIG[statusKey];
        const StatusIcon = status.icon;

        return (
          <article key={row.id} className={CARD_CLASS}>
            <div className={clsx('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90', status.halo)} aria-hidden />
            <header className="relative flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 via-brand/5 to-transparent text-lg font-semibold uppercase text-brand shadow-inner shadow-brand/10">
                    {categoryInitial}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-text">{categoryName}</h3>
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset backdrop-blur',
                          status.badgeClass,
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">
                      {row.period_month?.slice(0, 7) ? `Periode ${row.period_month.slice(0, 7)}` : 'Periode tidak diketahui'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-xs font-medium text-muted shadow-sm">
                    <span className="inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-wide">
                      <LineChart className="h-3 w-3" />
                      Carryover
                    </span>
                    <span className="text-[0.7rem] font-semibold text-text">
                      {row.carryover_enabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <label className="relative inline-flex h-6 w-11 cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={row.carryover_enabled}
                        onChange={(event) => onToggleCarryover(row, event.target.checked)}
                        className="peer sr-only"
                        aria-label={`Atur carryover untuk ${categoryName}`}
                      />
                      <span className="absolute inset-0 rounded-full bg-muted/60 transition peer-checked:bg-brand/70" />
                      <span className="relative ml-1 h-4 w-4 rounded-full bg-background shadow transition-transform peer-checked:translate-x-5" />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-background/80 text-muted shadow-sm transition hover:-translate-y-0.5 hover:text-text"
                    aria-label={`Edit ${categoryName}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-400/40 bg-rose-500/10 text-rose-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-500/20"
                    aria-label={`Hapus ${categoryName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-inner shadow-black/5 sm:grid-cols-3">
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Anggaran</span>
                  <p className="text-xl font-semibold text-text">{formatCurrency(planned, 'IDR')}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Terpakai</span>
                  <p className="text-xl font-semibold text-text/90">{formatCurrency(spent, 'IDR')}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Sisa</span>
                  <p
                    className={clsx(
                      'text-xl font-semibold',
                      overBudget ? 'text-rose-500' : 'text-emerald-500',
                    )}
                  >
                    {formatCurrency(remaining, 'IDR')}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4 shadow-inner shadow-black/5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-muted">
                  <span>Progres penggunaan</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-text">
                    {displayPercentage}%
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={clsx('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all', status.progress)}
                    style={{ width: `${displayPercentage}%` }}
                  />
                </div>
                {percentage > 100 ? (
                  <p className="text-xs font-semibold text-rose-500">
                    Pengeluaran sudah melebihi anggaran sebesar {formatCurrency(Math.abs(remaining), 'IDR')}.
                  </p>
                ) : null}
              </div>
            </header>

            <footer className="relative rounded-2xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Catatan</p>
              <p className="mt-2 leading-relaxed text-text/80">
                {row.notes?.trim() ? row.notes : 'Tidak ada catatan khusus.'}
              </p>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

