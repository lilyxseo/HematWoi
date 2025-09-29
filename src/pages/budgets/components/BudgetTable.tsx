import clsx from 'clsx';
import { Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetWithSpent } from '../../../lib/budgetApi';

interface BudgetTableProps {
  rows: BudgetWithSpent[];
  loading?: boolean;
  onEdit: (row: BudgetWithSpent) => void;
  onDelete: (row: BudgetWithSpent) => void;
  onToggleCarryover: (row: BudgetWithSpent, carryover: boolean) => void;
}

const CARD_WRAPPER_CLASS = 'grid gap-4 md:grid-cols-2 xl:grid-cols-3';

const CARD_CLASS =
  'flex flex-col gap-5 rounded-3xl border border-white/30 bg-gradient-to-br from-white/95 via-white/75 to-white/50 p-6 shadow-xl ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-2xl dark:border-white/5 dark:from-zinc-900/70 dark:via-zinc-900/40 dark:to-zinc-900/20 dark:ring-white/5';

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
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/60 p-8 text-center text-sm text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
      Belum ada anggaran untuk periode ini. Tambahkan kategori agar pengeluaran lebih terkontrol.
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
        const progressColor = overBudget ? 'bg-rose-500 dark:bg-rose-400' : 'bg-brand dark:bg-brand';
        const categoryName = row.category?.name ?? 'Tanpa kategori';
        const categoryInitial = categoryName.trim().charAt(0).toUpperCase() || 'B';
        const statusLabel = overBudget ? 'Melebihi batas' : percentage >= 90 ? 'Hampir habis' : 'Sehat';
        const statusClass = clsx(
          'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium shadow-sm ring-1 ring-inset',
          overBudget
            ? 'bg-rose-50 text-rose-600 ring-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
            : percentage >= 90
              ? 'bg-amber-50 text-amber-600 ring-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
              : 'bg-emerald-50 text-emerald-600 ring-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
        );

        return (
          <article key={row.id} className={CARD_CLASS}>
            <header className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-base font-semibold uppercase text-brand shadow-sm dark:bg-brand/20 dark:text-brand">
                  {categoryInitial}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{categoryName}</h3>
                    <span className={statusClass}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Anggaran periode {row.period_month?.slice(0, 7) ?? '-'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-200">
                  <span className="hidden text-xs sm:inline">Carryover</span>
                  <span className="sm:hidden">CO</span>
                  <span className="text-[0.7rem] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    {row.carryover_enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <label className="relative inline-flex h-6 w-12 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={row.carryover_enabled}
                      onChange={(event) => onToggleCarryover(row, event.target.checked)}
                      className="peer sr-only"
                      aria-label={`Atur carryover untuk ${categoryName}`}
                    />
                    <span className="absolute inset-0 rounded-full bg-zinc-200/80 transition peer-checked:bg-emerald-500/80 dark:bg-zinc-700/70 dark:peer-checked:bg-emerald-500/70" />
                    <span className="relative ml-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6" />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/40 bg-white/70 text-zinc-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200"
                  aria-label={`Edit ${categoryName}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200/60 bg-rose-50/80 text-rose-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                  aria-label={`Hapus ${categoryName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="rounded-2xl border border-white/40 bg-white/70 p-4 text-sm text-zinc-600 shadow-sm dark:border-white/5 dark:bg-zinc-900/40 dark:text-zinc-300">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Anggaran</span>
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(planned, 'IDR')}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Terpakai</span>
                  <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">{formatCurrency(spent, 'IDR')}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Sisa</span>
                  <p
                    className={clsx(
                      'text-base font-semibold',
                      overBudget ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    {formatCurrency(remaining, 'IDR')}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <span>Progres penggunaan</span>
                  <span>{displayPercentage}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/70">
                  <div
                    className={clsx('h-full rounded-full transition-all', progressColor)}
                    style={{ width: `${displayPercentage}%` }}
                  />
                </div>
                {percentage > 100 ? (
                  <p className="text-xs font-medium text-rose-500 dark:text-rose-400">
                    Pengeluaran sudah melebihi anggaran sebesar {formatCurrency(Math.abs(remaining), 'IDR')}.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-zinc-200/70 bg-white/50 p-4 text-sm text-zinc-500 shadow-sm dark:border-zinc-700/70 dark:bg-zinc-900/30 dark:text-zinc-300">
              <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Catatan</p>
              <p className="mt-1 leading-relaxed">
                {row.notes?.trim() ? row.notes : 'Tidak ada catatan.'}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

