import { Fragment, ReactNode } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Inbox, Pencil, Trash2, Paperclip } from 'lucide-react';
import clsx from 'clsx';
import { formatCurrency } from '../../lib/format';

export interface DayTransactionCategory {
  id: string;
  name: string;
  color?: string | null;
}

export interface DayTransactionAccount {
  id: string;
  name: string;
}

export interface DayTransactionRecord {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  note: string | null;
  merchant: string | null;
  receiptUrl: string | null;
  category: DayTransactionCategory | null;
  account: DayTransactionAccount | null;
}

export interface DaySummary {
  expense: number;
  income: number;
}

interface DayDetailDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  loading: boolean;
  error: string | null;
  transactions: DayTransactionRecord[];
  totals: DaySummary;
  showIncome: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onViewReceipt: (url: string) => void;
  deletingId?: string | null;
  footer?: ReactNode;
}

function formatDateLabel(date: Date | null): string {
  if (!date) {
    return 'Detail transaksi';
  }
  try {
    return format(date, 'EEEE, d MMMM yyyy', { locale: localeId });
  } catch {
    return date.toDateString();
  }
}

function formatTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return format(date, 'HH:mm');
}

function formatAmountDisplay(type: 'income' | 'expense', amount: number): string {
  const formatted = formatCurrency(Math.abs(amount), 'IDR');
  return type === 'income' ? `+ ${formatted}` : `- ${formatted}`;
}

function categoryStyle(category: DayTransactionCategory | null | undefined): string | undefined {
  const color = category?.color;
  if (!color) return undefined;
  return color;
}

export default function DayDetailDialog({
  open,
  onClose,
  date,
  loading,
  error,
  transactions,
  totals,
  showIncome,
  onEdit,
  onDelete,
  onViewReceipt,
  deletingId,
  footer,
}: DayDetailDialogProps) {
  const expenseDisplay = formatCurrency(Math.abs(totals.expense), 'IDR');
  const incomeDisplay = formatCurrency(Math.abs(totals.income), 'IDR');
  const net = totals.income - totals.expense;
  const netDisplay = formatCurrency(Math.abs(net), 'IDR');
  const netLabel = net >= 0 ? `+ ${netDisplay}` : `- ${netDisplay}`;

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center px-4 pb-12 pt-10 sm:items-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="translate-y-8 opacity-0 sm:translate-y-0 sm:scale-95"
              enterTo="translate-y-0 opacity-100 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="translate-y-0 opacity-100 sm:scale-100"
              leaveTo="translate-y-8 opacity-0 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-3xl bg-slate-950/95 p-6 text-left align-middle shadow-xl ring-1 ring-slate-800">
                <Dialog.Title className="text-lg font-semibold text-slate-100">
                  {formatDateLabel(date)}
                </Dialog.Title>
                <div className="mt-2 flex flex-wrap gap-3">
                  <div className="rounded-2xl bg-slate-900/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pengeluaran</p>
                    <p className="text-lg font-semibold text-rose-400">- {expenseDisplay}</p>
                  </div>
                  {showIncome && (
                    <div className="rounded-2xl bg-slate-900/80 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pemasukan</p>
                      <p className="text-lg font-semibold text-emerald-400">+ {incomeDisplay}</p>
                    </div>
                  )}
                  <div className="rounded-2xl bg-slate-900/60 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Netto</p>
                    <p
                      className={clsx(
                        'text-lg font-semibold',
                        net >= 0 ? 'text-emerald-400' : 'text-rose-400',
                      )}
                    >
                      {netLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {loading && (
                    <div className="space-y-3">
                      {[0, 1, 2].map((index) => (
                        <div
                          key={index}
                          className="h-20 animate-pulse rounded-2xl bg-slate-900/60"
                        />
                      ))}
                    </div>
                  )}

                  {!loading && error && (
                    <p className="rounded-2xl border border-rose-700/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
                      {error}
                    </p>
                  )}

                  {!loading && !error && transactions.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-700/80 px-4 py-16 text-center">
                      <Inbox className="mx-auto mb-3 h-6 w-6 text-slate-600" aria-hidden="true" />
                      <p className="text-sm font-medium text-slate-400">Tidak ada transaksi pada tanggal ini.</p>
                    </div>
                  )}

                  {!loading && !error && transactions.length > 0 && (
                    <ul className="space-y-3">
                      {transactions.map((transaction) => {
                        const time = formatTime(transaction.date);
                        const amount = formatAmountDisplay(transaction.type, transaction.amount);
                        return (
                          <li
                            key={transaction.id}
                            className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                  {time && <span className="font-mono text-slate-300">{time}</span>}
                                  {transaction.account?.name && (
                                    <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300">
                                      {transaction.account.name}
                                    </span>
                                  )}
                                  {transaction.category && (
                                    <span
                                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-900"
                                      style={{ backgroundColor: categoryStyle(transaction.category) || '#f87171' }}
                                    >
                                      {transaction.category.name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-slate-100">
                                  {transaction.note?.trim() || 'Tanpa catatan'}
                                </p>
                                {transaction.merchant && (
                                  <p className="text-xs text-slate-400">{transaction.merchant}</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-3">
                                <span
                                  className={clsx(
                                    'text-base font-semibold',
                                    transaction.type === 'income' ? 'text-emerald-400' : 'text-rose-400',
                                  )}
                                >
                                  {amount}
                                </span>
                                <div className="flex items-center gap-2">
                                  {transaction.receiptUrl && (
                                    <button
                                      type="button"
                                      onClick={() => onViewReceipt(transaction.receiptUrl as string)}
                                      className="rounded-full border border-slate-700/80 p-2 text-slate-300 transition hover:border-slate-500 hover:text-white"
                                      aria-label="Lihat nota"
                                    >
                                      <Paperclip className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onEdit(transaction.id)}
                                    className="rounded-full border border-slate-700/80 p-2 text-slate-300 transition hover:border-slate-500 hover:text-white"
                                    aria-label="Edit transaksi"
                                  >
                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDelete(transaction.id)}
                                    className={clsx(
                                      'rounded-full border border-slate-700/80 p-2 text-slate-300 transition hover:border-rose-500 hover:text-rose-300',
                                      deletingId === transaction.id && 'pointer-events-none opacity-60',
                                    )}
                                    aria-label="Hapus transaksi"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {footer && <div className="mt-6">{footer}</div>}

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
                  >
                    Tutup
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
