import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import type { CalendarTransaction } from '../../lib/calendarApi';
import type { DayTransactionsResult } from '../../hooks/useDayTransactions';
import { formatCurrency } from '../../lib/format';
import { removeTransaction } from '../../lib/api-transactions';

const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export interface DayDetailModalProps {
  open: boolean;
  dateKey: string | null;
  data: DayTransactionsResult | undefined;
  loading: boolean;
  onClose: () => void;
  categoryLookup: Map<string, string>;
  accountLookup: Map<string, string>;
  onDeleted?: (transactionId: string) => void;
}

function toDisplayDate(key: string | null): string {
  if (!key) return '';
  const parsed = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return key;
  }
  return DATE_FORMATTER.format(parsed);
}

function describeTransaction(
  tx: CalendarTransaction,
  categoryLookup: Map<string, string>,
  accountLookup: Map<string, string>,
): string {
  const parts: string[] = [];
  if (tx.type === 'expense') {
    parts.push('Pengeluaran');
  } else if (tx.type === 'income') {
    parts.push('Pemasukan');
  }
  const category = tx.category_id ? categoryLookup.get(tx.category_id) : null;
  if (category) parts.push(category);
  const account = tx.account_id ? accountLookup.get(tx.account_id) : null;
  if (account) parts.push(account);
  const merchant = tx.merchant_name ?? null;
  if (merchant) parts.push(merchant);
  return parts.join(' • ');
}

export default function DayDetailModal({
  open,
  dateKey,
  data,
  loading,
  onClose,
  categoryLookup,
  accountLookup,
  onDeleted,
}: DayDetailModalProps) {
  const navigate = useNavigate();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [open, onClose]);

  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [open]);

  const handleNavigateToEdit = (transactionId: string) => {
    navigate('/transactions', {
      state: { editTransactionId: transactionId },
    });
    onClose();
  };

  const handleDelete = async (transactionId: string) => {
    const confirmed = window.confirm('Hapus transaksi ini?');
    if (!confirmed) return;
    try {
      setDeletingId(transactionId);
      await removeTransaction(transactionId);
      onDeleted?.(transactionId);
    } catch (error) {
      console.error('[calendar] gagal menghapus transaksi', error);
      window.alert('Gagal menghapus transaksi. Coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  const transactions = data?.transactions ?? [];
  const totals = data?.totals ?? { expense: 0, income: 0, net: 0 };
  const displayDate = useMemo(() => toDisplayDate(dateKey), [dateKey]);

  if (!open || !dateKey) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-2 py-4 sm:px-4 lg:items-stretch lg:justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-detail-heading"
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        aria-label="Tutup detail harian"
      />
      <div className="relative flex h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-surface-1 text-text shadow-2xl lg:h-full lg:max-w-md lg:rounded-none lg:border-l">
        <header className="flex items-start justify-between gap-4 border-b border-border/60 bg-surface-1/80 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Detail Harian</p>
            <h2 id="day-detail-heading" className="mt-1 text-lg font-semibold text-text">
              {displayDate}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex flex-col">
                <span className="text-xs text-muted">Pengeluaran</span>
                <span className="font-semibold text-rose-400">
                  -{formatCurrency(totals.expense, 'IDR')}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted">Pemasukan</span>
                <span className="font-semibold text-emerald-400">
                  {formatCurrency(totals.income, 'IDR')}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted">Net</span>
                <span className="font-semibold text-text">
                  {formatCurrency(totals.net, 'IDR')}
                </span>
              </div>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface-2 text-text shadow-sm transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Tutup detail"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`day-skeleton-${index}`} className="animate-pulse rounded-2xl border border-border/50 bg-surface-2/40 p-4">
                  <div className="h-4 w-2/3 rounded bg-border/60" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-border/50" />
                  <div className="mt-4 h-9 w-full rounded-xl bg-border/40" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted">
              <p>Tidak ada transaksi untuk tanggal ini.</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {transactions.map((transaction) => (
                <li key={transaction.id} className="rounded-2xl border border-border/60 bg-surface-2/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text">
                        {transaction.title || (transaction.type === 'expense' ? 'Pengeluaran' : 'Pemasukan')}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {describeTransaction(transaction, categoryLookup, accountLookup)}
                      </p>
                      {transaction.notes ? (
                        <p className="mt-2 text-xs text-muted/80 break-words whitespace-pre-wrap">
                          {transaction.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right text-sm font-semibold">
                      <span
                        className={clsx(
                          'font-mono',
                          transaction.type === 'expense' ? 'text-rose-400' : 'text-emerald-400',
                        )}
                      >
                        {transaction.type === 'expense' ? '-' : '+'}
                        {formatCurrency(transaction.amount, 'IDR')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleNavigateToEdit(transaction.id)}
                      className="inline-flex min-h-[2.5rem] items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold text-text transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                    {transaction.receipt_url ? (
                      <a
                        href={transaction.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[2.5rem] items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold text-text transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                      >
                        <ExternalLink className="h-4 w-4" /> Nota
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDelete(transaction.id)}
                      disabled={deletingId === transaction.id}
                      className={clsx(
                        'inline-flex min-h-[2.5rem] items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60',
                        deletingId === transaction.id
                          ? 'cursor-not-allowed border-danger/30 text-danger/60'
                          : 'border-danger/40 text-danger hover:bg-danger/10',
                      )}
                    >
                      <Trash2 className="h-4 w-4" /> Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
