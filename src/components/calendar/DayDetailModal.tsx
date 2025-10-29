import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { FileText, Pencil, Trash2 } from 'lucide-react';
import type { DayAggregate } from '../../hooks/useMonthAggregates';
import type { DayTransactionRow } from '../../lib/calendarApi';
import { formatCurrency } from '../../lib/format';

interface DayDetailModalProps {
  open: boolean;
  date: Date | null;
  aggregate?: DayAggregate;
  transactions: DayTransactionRow[];
  loading: boolean;
  onClose: () => void;
  onEdit: (transaction: DayTransactionRow) => void;
  onDelete: (transaction: DayTransactionRow) => void;
}

function formatAmount(type: string, amount: number): string {
  const value = Number(amount ?? 0);
  const formatted = formatCurrency(Math.abs(value), 'IDR');
  if (type === 'expense') {
    return `- ${formatted}`;
  }
  if (type === 'income') {
    return `+ ${formatted}`;
  }
  return formatted;
}

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, 'HH:mm', { locale: localeId });
}

export default function DayDetailModal({
  open,
  date,
  aggregate,
  transactions,
  loading,
  onClose,
  onEdit,
  onDelete,
}: DayDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, item) => {
        const amount = Number(item.amount ?? 0);
        if (!Number.isFinite(amount)) {
          return acc;
        }
        if (item.type === 'expense') {
          acc.expense += amount;
        } else if (item.type === 'income') {
          acc.income += amount;
        }
        return acc;
      },
      { expense: 0, income: 0 },
    );
  }, [transactions]);

  const net = totals.income - totals.expense;
  const formattedDate = date
    ? format(date, "EEEE, d MMMM yyyy", { locale: localeId })
    : '';

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 pb-4 pt-10 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">{formattedDate}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-300">
              <span className="font-medium text-rose-300">
                Expense: {formatCurrency(totals.expense, 'IDR')}
              </span>
              <span className="font-medium text-emerald-300">
                Income: {formatCurrency(totals.income, 'IDR')}
              </span>
              <span className="font-medium text-slate-200">
                Net: {formatCurrency(net, 'IDR')}
              </span>
              {aggregate ? (
                <span className="text-xs text-slate-500">
                  {aggregate.count} transaksi
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Tutup detail"
          >
            ×
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`tx-skeleton-${index}`}
                  className="h-24 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40"
                />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
              Tidak ada transaksi untuk tanggal ini.
            </div>
          ) : (
            <ul className="space-y-3">
              {transactions.map((transaction) => {
                const time = formatTime(transaction.inserted_at ?? transaction.date ?? null);
                const categoryName = transaction.category_name ?? 'Tidak ada kategori';
                const amountLabel = formatAmount(transaction.type, transaction.amount);
                return (
                  <li
                    key={transaction.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          {time ? (
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {time}
                            </span>
                          ) : null}
                          <span
                            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200"
                            style={
                              transaction.category_color
                                ? { borderColor: transaction.category_color, color: transaction.category_color }
                                : undefined
                            }
                          >
                            {categoryName}
                          </span>
                          {transaction.account_name ? (
                            <span className="inline-flex items-center rounded-full bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300">
                              {transaction.account_name}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-sm text-slate-200">
                          {transaction.note || 'Tidak ada catatan'}
                        </div>
                        {transaction.merchant ? (
                          <div className="text-xs text-slate-500">
                            Merchant: {transaction.merchant}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={clsx(
                            'font-semibold',
                            transaction.type === 'expense'
                              ? 'text-rose-300'
                              : transaction.type === 'income'
                                ? 'text-emerald-300'
                                : 'text-slate-200',
                          )}
                        >
                          {amountLabel}
                        </span>
                        <div className="flex flex-wrap justify-end gap-2 text-xs">
                          {transaction.receipt_url ? (
                            <a
                              href={transaction.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-slate-200 transition hover:bg-slate-900"
                            >
                              <FileText className="h-3.5 w-3.5" /> Nota
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onEdit(transaction)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(transaction)}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-rose-200 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Hapus
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
      </div>
    </div>
  );
}
