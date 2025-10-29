import { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import clsx from 'clsx';
import { Pencil, ExternalLink, Trash2, FileText } from 'lucide-react';
import type { DayAggregate } from '../../hooks/useMonthAggregates';
import type { CalendarDayTransaction } from '../../hooks/useDayTransactions';
import { formatCurrency } from '../../lib/format';

export type DayDetailModalProps = {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  aggregate?: DayAggregate;
  transactions: CalendarDayTransaction[];
  categoryLookup: Record<string, string>;
  isLoading: boolean;
  onEdit: (transactionId: string) => void;
  onViewReceipt: (transactionId: string, url: string) => void;
  onDelete: (transactionId: string) => void;
  deletingId?: string | null;
};

function formatDateLabel(date: Date | null): string {
  if (!date) return 'Pilih tanggal';
  try {
    return format(date, "EEEE, d MMMM yyyy", { locale: localeId });
  } catch {
    return format(date, 'd MMM yyyy');
  }
}

function formatAmount(type: string, amount: number): string {
  const formatted = formatCurrency(Math.abs(amount));
  if (type === 'income') {
    return `+${formatted}`;
  }
  return `-${formatted}`;
}

export default function DayDetailModal({
  open,
  onClose,
  date,
  aggregate,
  transactions,
  categoryLookup,
  isLoading,
  onEdit,
  onViewReceipt,
  onDelete,
  deletingId,
}: DayDetailModalProps) {
  const totals = useMemo(() => {
    if (aggregate) {
      return {
        expense: aggregate.expense,
        income: aggregate.income,
        net: aggregate.income - aggregate.expense,
      };
    }
    let expense = 0;
    let income = 0;
    transactions.forEach((tx) => {
      if (tx.type === 'income') {
        income += tx.amount;
      } else if (tx.type === 'expense') {
        expense += tx.amount;
      }
    });
    return {
      expense,
      income,
      net: income - expense,
    };
  }, [aggregate, transactions]);

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[80]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-stretch justify-end">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-out duration-200"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <Dialog.Panel className="relative flex h-full w-full max-w-md flex-col overflow-hidden border-l border-slate-800/70 bg-surface-1/95 text-text shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-slate-800/70 px-6 py-5">
                  <div className="space-y-2">
                    <Dialog.Title className="text-sm font-semibold uppercase tracking-wide text-muted">
                      Detail Transaksi
                    </Dialog.Title>
                    <p className="text-lg font-semibold text-text">{formatDateLabel(date)}</p>
                    <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-rose-200/70">Expense</p>
                        <p className="mt-1 text-sm font-semibold text-rose-200">
                          {formatCurrency(totals.expense)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-emerald-200/70">Income</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-200">
                          {formatCurrency(totals.income)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-300/70">Net</p>
                        <p
                          className={clsx(
                            'mt-1 text-sm font-semibold',
                            totals.net >= 0 ? 'text-emerald-200' : 'text-rose-200',
                          )}
                        >
                          {totals.net >= 0 ? `+${formatCurrency(totals.net)}` : `-${formatCurrency(Math.abs(totals.net))}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-sm font-semibold text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                  >
                    ×
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={`skeleton-${index}`}
                          className="h-24 w-full animate-pulse rounded-2xl bg-slate-800/40"
                        />
                      ))}
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/40 px-4 py-10 text-center text-sm text-muted">
                      <FileText className="h-6 w-6 text-muted" aria-hidden="true" />
                      <p>Tidak ada transaksi pada tanggal ini.</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {transactions.map((tx) => {
                        const categoryName = tx.categoryId ? categoryLookup[tx.categoryId] : null;
                        const disabled = deletingId === tx.id;
                        return (
                          <li
                            key={tx.id}
                            className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                  <span className="font-mono text-sm text-text/80">
                                    {tx.timeLabel ?? '—'}
                                  </span>
                                  {categoryName ? (
                                    <span className="rounded-full border border-slate-700/70 bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                                      {categoryName}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-sm text-text/80">
                                  {tx.note ?? 'Tanpa catatan'}
                                </p>
                                {tx.merchant ? (
                                  <p className="text-xs text-muted">Merchant: {tx.merchant}</p>
                                ) : null}
                              </div>
                              <p
                                className={clsx(
                                  'whitespace-nowrap text-sm font-semibold',
                                  tx.type === 'income' ? 'text-emerald-300' : 'text-rose-300',
                                )}
                              >
                                {formatAmount(tx.type, tx.amount)}
                              </p>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => onEdit(tx.id)}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 font-medium text-text transition hover:border-brand/40 hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                                disabled={disabled}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              {tx.receiptUrl ? (
                                <button
                                  type="button"
                                  onClick={() => onViewReceipt(tx.id, tx.receiptUrl!)}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 font-medium text-text transition hover:border-brand/40 hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Nota
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => onDelete(tx.id)}
                                className="inline-flex items-center gap-1 rounded-full border border-rose-600/60 bg-rose-600/10 px-3 py-1 font-medium text-rose-200 transition hover:bg-rose-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
                                disabled={disabled}
                              >
                                {disabled ? (
                                  <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" aria-hidden="true" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Hapus
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
