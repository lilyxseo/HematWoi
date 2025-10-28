import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { format, isValid, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Pencil, Trash2, Paperclip } from 'lucide-react';
import type { CalendarFilters, RawTransactionRow } from '../../lib/calendarApi';
import { useDayTransactions } from '../../hooks/useDayTransactions';
import { useToast } from '../../context/ToastContext';
import { deleteTransaction } from '../../lib/api';
import ConfirmDialog from '../debts/ConfirmDialog';

interface CategoryOption {
  id: string;
  name: string;
  type?: 'income' | 'expense';
}

interface CalendarDetailModalProps {
  open: boolean;
  date: Date | null;
  filters: CalendarFilters;
  onClose: () => void;
  categories: Map<string, CategoryOption>;
  showIncome: boolean;
  onDataChange?: () => void;
}

function resolveDate(date: string | null | undefined): Date | null {
  if (!date) return null;
  const parsed = parseISO(date);
  if (isValid(parsed)) return parsed;
  const fallback = new Date(date);
  return isValid(fallback) ? fallback : null;
}

function getAmountDisplay(row: RawTransactionRow): string {
  const amount = Number(row.amount ?? 0) || 0;
  const prefix = row.type === 'expense' ? '-' : row.type === 'income' ? '+' : '';
  return `${prefix}Rp${amount.toLocaleString('id-ID')}`;
}

function getNote(row: RawTransactionRow): string {
  return row.note ?? row.notes ?? row.title ?? '';
}

function getMerchant(row: RawTransactionRow): string {
  return row.merchant_name ?? row.merchant ?? '';
}

export default function DetailModal({
  open,
  date,
  filters,
  onClose,
  categories,
  showIncome,
  onDataChange,
}: CalendarDetailModalProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { data, isLoading, refetch } = useDayTransactions({ date, filters, enabled: open });
  const [deleteTarget, setDeleteTarget] = useState<RawTransactionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setDeleteTarget(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const transactions = data?.transactions ?? [];
  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, item) => {
        const amount = Number(item.amount ?? 0) || 0;
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

  if (!open || !date) {
    return null;
  }

  const readableDate = format(date, 'PPP');

  const handleEdit = (row: RawTransactionRow) => {
    const key = format(date, 'yyyy-MM-dd');
    navigate(`/transactions?date=${encodeURIComponent(key)}&tx=${encodeURIComponent(row.id)}`);
  };

  const handleOpenReceipt = (row: RawTransactionRow) => {
    if (!row.receipt_url) return;
    window.open(row.receipt_url, '_blank', 'noopener');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteTransaction(deleteTarget.id);
      addToast('Transaksi dihapus', 'success');
      setDeleteTarget(null);
      await refetch();
      onDataChange?.();
    } catch (error) {
      console.error('[calendar:delete]', error);
      addToast('Gagal menghapus transaksi', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-surface-1/95 text-text shadow-2xl">
        <header className="border-b border-border/40 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted">{readableDate}</p>
              <h2 className="text-xl font-semibold">Detail transaksi harian</h2>
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface-2 px-4 py-2 text-sm">
              <p className="font-mono text-rose-400">Total expense: -Rp{totals.expense.toLocaleString('id-ID')}</p>
              {showIncome ? (
                <p className="font-mono text-emerald-400">Total income: +Rp{totals.income.toLocaleString('id-ID')}</p>
              ) : null}
              <p className="text-xs text-muted">Netto: Rp{(totals.income - totals.expense).toLocaleString('id-ID')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-sm text-muted transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
            aria-label="Tutup detail"
          >
            ×
          </button>
        </header>
        <section className="max-h-[60vh] overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 rounded-2xl bg-surface-2/60 animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-sm text-muted">Tidak ada transaksi pada tanggal ini.</p>
          ) : (
            <ul className="space-y-3">
              {transactions.map((item) => {
                const timestamp = resolveDate(item.transaction_date);
                const timeLabel = timestamp ? format(timestamp, 'HH:mm') : '—';
                const category = item.category_id ? categories.get(item.category_id) : null;
                const merchant = getMerchant(item);
                const note = getNote(item);
                return (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-border/60 bg-surface-2/80 p-4 backdrop-blur"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-xs text-muted">{timeLabel}</p>
                        <p className="text-sm font-semibold text-white">{note || 'Tanpa catatan'}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          {category ? (
                            <span className="rounded-full bg-slate-800/80 px-2 py-1 text-[11px] text-slate-200">
                              {category.name}
                            </span>
                          ) : null}
                          {merchant ? <span>{merchant}</span> : null}
                          {item.receipt_url ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted">
                              <Paperclip className="h-3 w-3" /> Nota
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p
                        className={
                          item.type === 'expense'
                            ? 'text-sm font-mono text-rose-400'
                            : 'text-sm font-mono text-emerald-400'
                        }
                      >
                        {getAmountDisplay(item)}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[color:var(--accent,theme(colors.rose.400))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </button>
                      {item.receipt_url ? (
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(item)}
                          className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-white transition hover:border-[color:var(--accent,theme(colors.rose.400))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
                        >
                          <ExternalLink className="h-4 w-4" /> Nota
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="inline-flex items-center gap-1 rounded-xl border border-danger/60 px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                      >
                        <Trash2 className="h-4 w-4" /> Hapus
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus transaksi?"
        description="Tindakan ini tidak bisa dibatalkan."
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>,
    document.body,
  );
}
