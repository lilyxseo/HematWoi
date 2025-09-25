import { Fragment } from 'react';
import { PencilLine, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { formatCurrency } from '../../lib/format';
import type { BudgetRowView } from '../../hooks/useBudgets';

interface BudgetTableProps {
  data: BudgetRowView[];
  loading?: boolean;
  processingId?: string | null;
  onEdit: (row: BudgetRowView) => void;
  onDelete: (row: BudgetRowView) => void;
  onToggleCarryover: (row: BudgetRowView, value: boolean) => void;
}

export default function BudgetTable({
  data,
  loading = false,
  processingId = null,
  onEdit,
  onDelete,
  onToggleCarryover,
}: BudgetTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/60 shadow-sm backdrop-blur dark:border-white/5 dark:bg-zinc-900/40">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200/70 text-left text-sm text-slate-600 dark:divide-white/10 dark:text-slate-300">
          <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr className="bg-white/80 backdrop-blur dark:bg-zinc-950/60">
              <th scope="col" className="sticky top-0 z-10 px-6 py-4 font-semibold">
                Kategori
              </th>
              <th scope="col" className="sticky top-0 z-10 px-6 py-4 font-semibold">
                Planned
              </th>
              <th scope="col" className="sticky top-0 z-10 px-6 py-4 font-semibold">
                Spent
              </th>
              <th scope="col" className="sticky top-0 z-10 px-6 py-4 font-semibold">
                Remaining
              </th>
              <th scope="col" className="sticky top-0 z-10 px-6 py-4 font-semibold">
                Carryover
              </th>
              <th scope="col" className="sticky top-0 z-10 px-6 py-4 font-semibold">
                Catatan
              </th>
              <th scope="col" className="sticky top-0 z-10 px-6 py-4 font-semibold">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  className="animate-pulse border-b border-slate-100/70 bg-white/50 dark:border-white/5 dark:bg-white/5"
                >
                  {Array.from({ length: 7 }).map((__, cellIndex) => (
                    <td key={cellIndex} className="px-6 py-4">
                      <div className="h-4 w-full max-w-[160px] rounded-full bg-slate-200 dark:bg-slate-700/80" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                  <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-300/60 bg-white/40 p-6 dark:border-white/10 dark:bg-white/5">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">Belum ada anggaran di periode ini.</p>
                    <p className="mt-2 text-sm">Tambahkan kategori pengeluaran untuk mulai mengatur anggaran Anda.</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const disabled = processingId === row.id;
                const remainingClass = clsx('font-semibold', {
                  'text-rose-500 dark:text-rose-400': row.remaining < 0,
                  'text-emerald-600 dark:text-emerald-300': row.remaining >= 0,
                });
                return (
                  <Fragment key={row.id}>
                    <tr className="group border-b border-slate-100/70 bg-white/50 transition hover:bg-sky-50/70 dark:border-white/5 dark:bg-white/5 dark:hover:bg-sky-500/10">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-white">{row.categoryName}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {formatCurrency(row.amountPlanned)}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">
                        {formatCurrency(row.currentSpent)}
                      </td>
                      <td className={`px-6 py-4 ${remainingClass}`}>
                        {formatCurrency(row.remaining)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => onToggleCarryover(row, !row.carryoverEnabled)}
                          className={clsx(
                            'flex h-9 w-16 items-center rounded-full border px-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10',
                            row.carryoverEnabled
                              ? 'justify-end border-emerald-200 bg-emerald-500/10 dark:bg-emerald-500/20'
                              : 'justify-start border-slate-200 bg-white dark:border-white/10 dark:bg-zinc-900'
                          )}
                          aria-pressed={row.carryoverEnabled}
                          disabled={disabled}
                        >
                          <span
                            className={clsx(
                              'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition',
                              row.carryoverEnabled
                                ? 'bg-emerald-500 text-white shadow'
                                : 'bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-white'
                            )}
                          >
                            {row.carryoverEnabled ? 'On' : 'Off'}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-300">
                        {row.notes ? row.notes : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-sky-600 shadow-sm transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/10 dark:text-sky-300"
                            aria-label="Edit anggaran"
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-500/15 dark:text-rose-300"
                            aria-label="Hapus anggaran"
                            disabled={disabled}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
