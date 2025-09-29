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

const CARD_WRAPPER_CLASS = 'grid gap-5 md:grid-cols-2 xl:grid-cols-3';

const CARD_CLASS =
  'group flex flex-col gap-5 rounded-3xl border border-zinc-200/80 bg-white/80 p-6 shadow-sm ring-1 ring-transparent transition duration-200 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg hover:ring-brand/20 dark:border-white/5 dark:bg-zinc-900/70';

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

        return (
          <article
            key={row.id}
            className={clsx(
              CARD_CLASS,
              overBudget
                ? 'border-rose-200/70 bg-rose-50/60 ring-rose-100/50 dark:border-rose-500/30 dark:bg-rose-500/10'
                : 'bg-white/80 dark:bg-zinc-900/70'
            )}
          >
            <header className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand dark:bg-brand/20 dark:text-brand-foreground/80">
                    {row.category?.group?.name ?? 'Kategori'}
                  </span>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                    {row.category?.name ?? 'Tanpa kategori'}
                  </h3>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-end gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    <span>Carryover</span>
                    <label className="relative inline-flex h-7 w-14 cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={row.carryover_enabled}
                        onChange={(event) => onToggleCarryover(row, event.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="absolute inset-0 rounded-full bg-zinc-200 transition peer-checked:bg-emerald-500/80 dark:bg-zinc-800 dark:peer-checked:bg-emerald-500/70" />
                      <span className="relative ml-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6" />
                    </label>
                    <span className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      {row.carryover_enabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/80 text-zinc-600 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200"
                      aria-label={`Edit ${row.category?.name ?? 'budget'}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200/60 bg-rose-50/70 text-rose-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                      aria-label={`Hapus ${row.category?.name ?? 'budget'}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {row.notes?.trim() ? (
                <p className="rounded-2xl bg-zinc-100/70 px-4 py-2 text-sm text-zinc-600 shadow-sm dark:bg-zinc-800/70 dark:text-zinc-300">
                  {row.notes}
                </p>
              ) : null}
            </header>

            <div className="grid grid-cols-1 gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <div className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 shadow-sm dark:bg-zinc-900/60">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Anggaran</span>
                <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(planned, 'IDR')}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 shadow-sm dark:bg-zinc-900/60">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Terpakai</span>
                <span>{formatCurrency(spent, 'IDR')}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 shadow-sm dark:bg-zinc-900/60">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Sisa</span>
                <span
                  className={clsx(
                    'text-base font-semibold',
                    overBudget ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {formatCurrency(remaining, 'IDR')}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span>Progres penggunaan</span>
                <span className="text-zinc-700 dark:text-zinc-300">{displayPercentage}%</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/80">
                <div
                  className={clsx('absolute inset-y-0 left-0 rounded-full transition-all duration-300', progressColor)}
                  style={{ width: `${displayPercentage}%` }}
                />
              </div>
              {percentage > 100 ? (
                <p className="text-xs font-medium text-rose-500 dark:text-rose-400">
                  Pengeluaran sudah melebihi anggaran sebesar {formatCurrency(Math.abs(remaining), 'IDR')}.
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

