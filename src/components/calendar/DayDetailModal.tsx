import { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import type { CalendarDayTransaction } from '../../lib/calendarApi';
import type { DayTotals } from '../../hooks/useDayTransactions';

export interface DayDetailModalProps {
  open: boolean;
  date: string | null;
  totals: DayTotals;
  transactions: CalendarDayTransaction[];
  loading: boolean;
  error: unknown;
  deletingId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onViewReceipt: (url: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  showIncome: boolean;
  categoryLookup?: Map<string, { name: string; color?: string | null }>;
  accountLookup?: Map<string, string>;
  merchantLookup?: Map<string, string>;
}

function formatDateLabel(date: string | null) {
  if (!date) return '';
  try {
    const parsed = new Date(date);
    return format(parsed, "EEEE, d MMMM yyyy");
  } catch {
    return date;
  }
}

function formatTimeLabel(value: string | null) {
  if (!value) return '';
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return format(parsed, 'HH:mm');
  } catch {
    return '';
  }
}

function formatAmountDisplay(type: string, amount: number) {
  const prefix = type === 'expense' ? '-' : '+';
  return `${prefix} ${formatCurrency(Math.abs(amount) || 0)}`;
}

export default function DayDetailModal({
  open,
  date,
  totals,
  transactions,
  loading,
  error,
  deletingId,
  onClose,
  onEdit,
  onViewReceipt,
  onDelete,
  showIncome,
  categoryLookup,
  accountLookup,
  merchantLookup,
}: DayDetailModalProps) {
  const formattedDate = useMemo(() => formatDateLabel(date), [date]);
  const net = totals.totalIncome - totals.totalExpense;

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Hapus transaksi ini?');
    if (!confirmed) return;
    await onDelete(id);
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[90]" onClose={onClose}>
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
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-2xl transform overflow-hidden rounded-3xl border border-border/60 bg-surface-1/95 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex flex-col gap-6">
                  <header>
                    <Dialog.Title className="text-lg font-semibold text-text">
                      {formattedDate || 'Detail Transaksi'}
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-muted">
                      Ringkasan pengeluaran dan pemasukan harian
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/70 bg-surface-2/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted">
                          Total Expense
                        </p>
                        <p className="mt-1 text-sm font-semibold text-rose-400">
                          - {formatCurrency(totals.totalExpense)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-surface-2/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted">
                          Total Income
                        </p>
                        <p className="mt-1 text-sm font-semibold text-emerald-400">
                          {showIncome
                            ? `+ ${formatCurrency(totals.totalIncome)}`
                            : '+ Rp0'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-surface-2/70 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted">
                          Net
                        </p>
                        <p
                          className={clsx(
                            'mt-1 text-sm font-semibold',
                            net >= 0 ? 'text-emerald-400' : 'text-rose-400',
                          )}
                        >
                          {net >= 0 ? '+' : '-'} {formatCurrency(Math.abs(net))}
                        </p>
                      </div>
                    </div>
                  </header>

                  {loading ? (
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`detail-skeleton-${index}`}
                          className="h-24 animate-pulse rounded-2xl bg-surface-2/70"
                        />
                      ))}
                    </div>
                  ) : error ? (
                    <div className="rounded-2xl border border-rose-500/60 bg-rose-500/10 p-4 text-sm text-rose-200">
                      {(error as { message?: string })?.message ||
                        'Gagal memuat transaksi.'}
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-surface-2/40 p-6 text-center text-sm text-muted">
                      Tidak ada transaksi
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {transactions.map((transaction) => {
                        const category = transaction.category_id
                          ? categoryLookup?.get(transaction.category_id)
                          : null;
                        const accountName = transaction.account_id
                          ? accountLookup?.get(transaction.account_id)
                          : null;
                        const merchantName = transaction.merchant_id
                          ? merchantLookup?.get(transaction.merchant_id)
                          : null;
                        const timeLabel = formatTimeLabel(transaction.transaction_date);
                        const isDeleting = deletingId === transaction.id;
                        return (
                          <article
                            key={transaction.id}
                            className="rounded-2xl border border-border/60 bg-surface-2/70 p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                  {timeLabel ? (
                                    <span className="rounded-full bg-surface-1/60 px-2 py-0.5 font-semibold">
                                      {timeLabel}
                                    </span>
                                  ) : null}
                                  {category ? (
                                    <span
                                      className="rounded-full border border-border/40 bg-surface-1/80 px-2 py-0.5 font-semibold text-text"
                                      style={
                                        category.color
                                          ? {
                                              borderColor: category.color,
                                            }
                                          : undefined
                                      }
                                    >
                                      {category.name}
                                    </span>
                                  ) : null}
                                  {accountName ? (
                                    <span className="rounded-full bg-surface-1/60 px-2 py-0.5">
                                      {accountName}
                                    </span>
                                  ) : null}
                                  {merchantName ? (
                                    <span className="rounded-full bg-surface-1/60 px-2 py-0.5">
                                      {merchantName}
                                    </span>
                                  ) : null}
                                  {!merchantName && transaction.merchant_id ? (
                                    <span className="rounded-full bg-surface-1/60 px-2 py-0.5">
                                      {transaction.merchant_id}
                                    </span>
                                  ) : null}
                                </div>
                                {transaction.note ? (
                                  <p className="mt-2 text-sm text-text">
                                    {transaction.note}
                                  </p>
                                ) : null}
                              </div>
                              <div className="text-right">
                                <p
                                  className={clsx(
                                    'font-mono text-sm font-semibold',
                                    transaction.type === 'expense'
                                      ? 'text-rose-400'
                                      : 'text-emerald-400',
                                  )}
                                >
                                  {formatAmountDisplay(
                                    transaction.type,
                                    Number(transaction.amount) || 0,
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => onEdit(transaction.id)}
                                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-1 px-3 py-1 text-xs font-medium text-text transition hover:bg-surface-2"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              {transaction.receipt_url ? (
                                <button
                                  type="button"
                                  onClick={() => onViewReceipt(transaction.receipt_url!)}
                                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-1 px-3 py-1 text-xs font-medium text-text transition hover:bg-surface-2"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Nota
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleDelete(transaction.id)}
                                disabled={isDeleting}
                                className={clsx(
                                  'inline-flex items-center gap-1 rounded-full border border-rose-500/70 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300 transition',
                                  isDeleting
                                    ? 'cursor-wait opacity-60'
                                    : 'hover:bg-rose-500/20',
                                )}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {isDeleting ? 'Menghapus...' : 'Hapus'}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center rounded-full border border-border/70 bg-surface-2 px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-1"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
