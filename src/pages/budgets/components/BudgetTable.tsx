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

const CARD_BASE_CLASS =
  'rounded-2xl border border-white/20 dark:border-white/5 bg-gradient-to-b from-white/80 to-white/50 dark:from-zinc-900/60 dark:to-zinc-900/30 backdrop-blur shadow-sm';

function LoadingCards() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className={clsx(CARD_BASE_CLASS, 'animate-pulse p-6')}>
          <div className="h-6 w-1/3 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((__, cardIndex) => (
              <div key={cardIndex} className="space-y-2">
                <div className="h-4 w-16 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
                <div className="h-5 w-24 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60" />
              </div>
            ))}
          </div>
          <div className="mt-5 h-2 w-full rounded-full bg-zinc-200/60 dark:bg-zinc-800/60" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className={clsx(CARD_BASE_CLASS, 'p-10 text-center text-sm text-zinc-500 dark:text-zinc-400')}>
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
    <div className="space-y-4">
      {rows.map((row) => {
        const planned = Number(row.amount_planned ?? 0);
        const spent = Number(row.spent ?? 0);
        const remaining = Number(row.remaining ?? planned - spent);
        const isOverBudget = remaining < 0;
        const progressRaw = planned > 0 ? (spent / planned) * 100 : spent > 0 ? 100 : 0;
        const progress = Math.max(0, Math.min(130, progressRaw));
        const remainingClass = isOverBudget
          ? 'text-rose-500 dark:text-rose-400'
          : 'text-emerald-600 dark:text-emerald-400';
        const carryoverToggleId = `carryover-${row.id}`;

        return (
          <article key={row.id} className={clsx(CARD_BASE_CLASS, 'p-6 text-sm text-zinc-700 dark:text-zinc-200')}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {row.category?.name ?? 'Tanpa kategori'}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {row.notes?.trim() ? row.notes : 'Belum ada catatan untuk anggaran ini.'}
                </p>
              </div>
              <div className="flex items-center gap-3 self-start md:self-auto">
                <div className="flex items-center gap-3 rounded-xl border border-white/40 bg-white/50 px-3 py-2 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">Carryover</span>
                  <label className="relative inline-flex h-6 w-12 cursor-pointer items-center" htmlFor={carryoverToggleId}>
                    <input
                      id={carryoverToggleId}
                      type="checkbox"
                      checked={row.carryover_enabled}
                      onChange={(event) => onToggleCarryover(row, event.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="absolute inset-0 rounded-full bg-zinc-200/70 transition peer-checked:bg-emerald-500/80 dark:bg-zinc-800/70 dark:peer-checked:bg-emerald-500/70" />
                    <span className="relative ml-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6" />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/60 text-zinc-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200"
                    aria-label={`Edit ${row.category?.name ?? 'budget'}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200/50 bg-rose-50/60 text-rose-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                    aria-label={`Hapus ${row.category?.name ?? 'budget'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/70 p-4 shadow-sm dark:bg-zinc-950/40">
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Planned</p>
                <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(planned, 'IDR')}
                </p>
              </div>
              <div className="rounded-2xl bg-white/70 p-4 shadow-sm dark:bg-zinc-950/40">
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Spent</p>
                <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatCurrency(spent, 'IDR')}
                </p>
              </div>
              <div className="rounded-2xl bg-white/70 p-4 shadow-sm dark:bg-zinc-950/40">
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Remaining</p>
                <p className={clsx('mt-2 text-lg font-semibold', remainingClass)}>
                  {formatCurrency(remaining, 'IDR')}
                </p>
                {isOverBudget ? (
                  <p className="mt-1 text-xs font-medium text-rose-500 dark:text-rose-400">Anggaran melebihi batas!</p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span>Progress penggunaan</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-200/70 dark:bg-zinc-800/60">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    isOverBudget
                      ? 'bg-rose-500/80 dark:bg-rose-500/80'
                      : 'bg-emerald-500/80 dark:bg-emerald-500/80'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

