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
  'group relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/85 p-6 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_26px_90px_-32px_rgba(15,23,42,0.55)] dark:border-zinc-800/70 dark:bg-zinc-900/70';

function LoadingCards() {
  return (
    <div className={clsx(CARD_WRAPPER_CLASS)}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className={clsx(CARD_CLASS, 'animate-pulse')}
        >
          <div className="h-4 w-28 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
          <div className="space-y-3">
            <div className="h-3 w-3/4 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
            <div className="h-3 w-2/3 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
          <div className="space-y-2">
            <div className="h-3 w-1/2 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
            <div className="h-3 w-1/3 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
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
          <article key={row.id} className={CARD_CLASS}>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-zinc-800/30 dark:via-zinc-800/20" />
            <header className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Kategori</p>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {row.category?.name ?? 'Tanpa kategori'}
                </h3>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <div className="inline-flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/90 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:text-zinc-300">
                  <span className="hidden sm:inline">Carryover</span>
                  <label className="relative inline-flex h-6 w-12 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={row.carryover_enabled}
                      onChange={(event) => onToggleCarryover(row, event.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="absolute inset-0 rounded-full bg-zinc-200/70 transition peer-checked:bg-emerald-500/80 dark:bg-zinc-800/70 dark:peer-checked:bg-emerald-500/70" />
                    <span className="relative ml-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6" />
                    <span className="sr-only">Aktifkan carryover</span>
                  </label>
                  <span
                    className={clsx(
                      'hidden rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.25em] sm:inline-flex',
                      row.carryover_enabled
                        ? 'bg-emerald-100/70 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-zinc-200/60 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400',
                    )}
                  >
                    {row.carryover_enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-zinc-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200"
                  aria-label={`Edit ${row.category?.name ?? 'budget'}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200/50 bg-rose-50/60 text-rose-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                  aria-label={`Hapus ${row.category?.name ?? 'budget'}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="relative grid gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <div className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 shadow-sm backdrop-blur dark:bg-zinc-900/50">
                <span>Anggaran</span>
                <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(planned, 'IDR')}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-transparent px-4 py-3">
                <span>Terpakai</span>
                <span>{formatCurrency(spent, 'IDR')}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-transparent px-4 py-3">
                <span>Sisa</span>
                <span className={clsx('font-semibold', overBudget ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {formatCurrency(remaining, 'IDR')}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>Progres penggunaan</span>
                <span>{displayPercentage}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800/70">
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

            <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-5 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:text-zinc-300">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Catatan</p>
              <p className="mt-2 leading-relaxed">{row.notes?.trim() ? row.notes : 'Tidak ada catatan.'}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

