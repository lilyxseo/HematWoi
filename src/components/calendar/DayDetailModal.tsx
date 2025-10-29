import { Fragment, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDayTransactions } from '../../hooks/useDayTransactions';
import type { NormalizedCalendarFilters } from '../../lib/calendarApi';
import type { CategoryRecord } from '../../lib/api-categories';
import type { AccountRecord } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { removeTransaction } from '../../lib/api-transactions';
import { useToast } from '../../context/ToastContext';

interface DayDetailModalProps {
  open: boolean;
  date: string | null;
  filters: NormalizedCalendarFilters;
  categories: CategoryRecord[];
  accounts: AccountRecord[];
  onClose: () => void;
  onDeleted: () => void;
}

export default function DayDetailModal({
  open,
  date,
  filters,
  categories,
  accounts,
  onClose,
  onDeleted,
}: DayDetailModalProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryRecord>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

  const accountMap = useMemo(() => {
    const map = new Map<string, AccountRecord>();
    accounts.forEach((account) => {
      map.set(account.id, account);
    });
    return map;
  }, [accounts]);

  const dayQuery = useDayTransactions(date, filters, open);

  const transactions = dayQuery.data ?? [];
  const isLoading = dayQuery.isLoading || dayQuery.isFetching;

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        if (tx.type === 'expense') {
          acc.expense += tx.amount;
        } else if (tx.type === 'income') {
          acc.income += tx.amount;
        }
        acc.count += 1;
        return acc;
      },
      { expense: 0, income: 0, count: 0 },
    );
  }, [transactions]);

  const net = totals.income - totals.expense;

  const handleDelete = async (id: string) => {
    if (!id || deletingId) return;
    const confirmed = window.confirm('Hapus transaksi ini? Aksi ini tidak bisa dibatalkan.');
    if (!confirmed) return;

    try {
      setDeletingId(id);
      const success = await removeTransaction(id);
      if (success) {
        addToast('Transaksi dihapus', 'success');
        await dayQuery.refetch();
        onDeleted();
      } else {
        addToast('Gagal menghapus transaksi', 'error');
      }
    } catch (error) {
      console.error('[calendar] removeTransaction error', error);
      addToast((error as Error)?.message ?? 'Gagal menghapus transaksi', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (id: string) => {
    onClose();
    navigate(`/transactions?focus=${id}`);
  };

  const handleOpenReceipt = (url: string | null) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formattedDate = date
    ? format(new Date(`${date}T00:00:00`), 'EEEE, dd MMMM yyyy', { locale: localeId })
    : '';

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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

        <div className="fixed inset-0 flex flex-col justify-end px-4 py-4 sm:px-6 md:items-center md:justify-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="translate-y-full opacity-0 md:translate-y-0 md:scale-95"
            enterTo="translate-y-0 opacity-100 md:scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 md:scale-100"
            leaveTo="translate-y-full opacity-0 md:translate-y-4 md:scale-95"
          >
            <Dialog.Panel className="flex h-[calc(100vh-5rem)] w-full max-w-full flex-col overflow-hidden rounded-t-3xl border border-slate-800 bg-slate-950 text-left shadow-2xl transition-all md:h-[80vh] md:max-w-2xl md:rounded-3xl">
              <div className="border-b border-slate-800 px-4 pb-3 pt-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Dialog.Title className="text-base font-semibold text-slate-100">
                      {formattedDate || 'Detail harian'}
                    </Dialog.Title>
                    <p className="mt-1 text-xs text-slate-400">
                      {totals.count > 0
                        ? `${totals.count} transaksi`
                        : 'Tidak ada transaksi'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    aria-label="Tutup detail hari"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-mono leading-tight sm:text-xs">
                  <span className="font-mono text-rose-400">-{formatCurrency(totals.expense)}</span>
                  <span className="font-mono text-emerald-400">+{formatCurrency(totals.income)}</span>
                  <span
                    className={clsx(
                      'font-mono text-xs font-semibold',
                      net >= 0 ? 'text-emerald-400' : 'text-rose-400',
                    )}
                  >
                    {net >= 0 ? '+' : ''}
                    {formatCurrency(net)}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="no-scrollbar max-h-[65vh] overflow-y-auto px-4 py-4 sm:px-6 md:max-h-[60vh]">
                  {dayQuery.isError ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                      <p>Gagal memuat transaksi. Coba lagi?</p>
                      <button
                        type="button"
                        onClick={() => dayQuery.refetch()}
                        className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 px-4 font-semibold text-rose-100 transition hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                      >
                        Muat ulang
                      </button>
                    </div>
                  ) : isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`skeleton-${index}`}
                          className="h-20 animate-pulse rounded-2xl bg-slate-900/60"
                        />
                      ))}
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
                      Tidak ada transaksi
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-4">
                      {transactions.map((tx) => {
                        const categoryName = tx.category_id
                          ? categoryMap.get(tx.category_id)?.name ?? 'Tanpa kategori'
                          : 'Tanpa kategori';
                        const accountName = tx.account_id
                          ? accountMap.get(tx.account_id)?.name ?? 'Tanpa akun'
                          : 'Tanpa akun';
                        return (
                          <li
                            key={tx.id}
                            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-100">
                                  {tx.title?.trim() || 'Tanpa judul'}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {categoryName} • {accountName}
                                </p>
                                {tx.merchant_name ? (
                                  <p className="mt-1 text-xs text-slate-400">Merchant: {tx.merchant_name}</p>
                                ) : null}
                                {tx.notes ? (
                                  <p className="mt-2 text-sm text-slate-300">
                                    {tx.notes}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span
                                  className={`font-mono text-sm ${
                                    tx.type === 'expense' ? 'text-rose-400' : 'text-emerald-400'
                                  }`}
                                >
                                  {tx.type === 'expense' ? '-' : '+'}
                                  {formatCurrency(tx.amount)}
                                </span>
                                <div className="flex flex-wrap justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(tx.id)}
                                    className="inline-flex h-9 items-center justify-center gap-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-100 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                    aria-label="Edit transaksi"
                                  >
                                    <Pencil className="h-4 w-4" /> Edit
                                  </button>
                                  {tx.receipt_url ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReceipt(tx.receipt_url)}
                                      className="inline-flex h-9 items-center justify-center gap-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-100 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                      aria-label="Lihat nota"
                                    >
                                      <ExternalLink className="h-4 w-4" /> Nota
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(tx.id)}
                                    disabled={deletingId === tx.id}
                                    className="inline-flex h-9 items-center justify-center gap-1 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label="Hapus transaksi"
                                  >
                                    <Trash2 className="h-4 w-4" /> Hapus
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

              <div className="border-t border-slate-800 px-4 py-3 text-right text-xs text-slate-500 sm:px-6">
                Data ditarik sesuai filter aktif
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
