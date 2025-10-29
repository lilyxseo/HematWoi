import { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarFilters } from '../../lib/calendarApi';
import { useDayTransactions } from '../../hooks/useDayTransactions';
import { removeTransaction } from '../../lib/api-transactions';
import { useToast } from '../../context/ToastContext';
import clsx from 'clsx';

const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

interface DayDetailModalProps {
  open: boolean;
  date: string | null;
  onClose: () => void;
  filters: CalendarFilters;
  summary?: {
    totalExpense: number;
    totalIncome: number;
    count: number;
  };
}

export default function DayDetailModal({
  open,
  date,
  onClose,
  filters,
  summary,
}: DayDetailModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data, isLoading, isFetching } = useDayTransactions(date, filters, open);

  const header = useMemo(() => {
    if (!date) {
      return {
        title: 'Detail transaksi',
        net: 0,
      };
    }
    const parsed = parseISO(date);
    const title = format(parsed, 'EEEE, dd MMMM yyyy', { locale: localeId });
    const expense = summary?.totalExpense ?? 0;
    const income = summary?.totalIncome ?? 0;
    const net = income - expense;
    return { title, expense, income, net };
  }, [date, summary]);

  const handleEdit = (id: string) => {
    navigate(`/transactions?edit=${id}`);
    onClose();
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Hapus transaksi ini?');
    if (!confirm) return;
    try {
      await removeTransaction(id);
      addToast('Transaksi dihapus', 'success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar', 'aggregates'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar', 'day', date] }),
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus transaksi';
      addToast(message, 'error');
    }
  };

  return (
    <Transition appear show={open} as={Fragment}>
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-stretch justify-center p-0 sm:p-6 lg:justify-end">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="translate-y-6 opacity-0 lg:translate-y-0 lg:translate-x-8"
              enterTo="translate-y-0 opacity-100"
              leave="ease-in duration-150"
              leaveFrom="translate-y-0 opacity-100"
              leaveTo="translate-y-6 opacity-0 lg:translate-y-0 lg:translate-x-8"
            >
              <Dialog.Panel className="flex h-full w-full max-w-md flex-col overflow-hidden bg-surface-1 text-text shadow-2xl sm:rounded-3xl">
                <div className="flex items-start justify-between border-b border-border/60 bg-surface-2 px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-1 text-left">
                    <Dialog.Title className="text-base font-semibold text-white">
                      {header.title}
                    </Dialog.Title>
                    <p className="text-sm text-slate-400">
                      Pengeluaran {CURRENCY_FORMATTER.format(summary?.totalExpense ?? 0)} · Pemasukan{' '}
                      {CURRENCY_FORMATTER.format(summary?.totalIncome ?? 0)}
                    </p>
                    <p
                      className={clsx(
                        'text-sm font-semibold',
                        (header.net ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300',
                      )}
                    >
                      Net {CURRENCY_FORMATTER.format(header.net ?? 0)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface-1 text-slate-300 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label="Tutup"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {isLoading ? (
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="space-y-2 rounded-2xl bg-slate-900/40 p-4">
                          <div className="h-5 w-1/2 animate-pulse rounded bg-slate-700/60" />
                          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-800/60" />
                          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-800/60" />
                        </div>
                      ))}
                    </div>
                  ) : data && data.length > 0 ? (
                    <ul className="flex flex-col gap-4">
                      {data.map((tx) => (
                        <li
                          key={tx.id}
                          className="rounded-3xl border border-border/60 bg-surface-2/80 p-4 text-sm text-slate-200 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-white">
                                {tx.title || 'Tanpa judul'}
                              </p>
                              {tx.notes ? (
                                <p className="mt-1 text-xs text-slate-400 break-words">
                                  {tx.notes}
                                </p>
                              ) : null}
                            </div>
                            <span
                              className={clsx(
                                'shrink-0 font-mono text-sm',
                                tx.type === 'expense' ? 'text-rose-300' : 'text-emerald-300',
                              )}
                            >
                              {tx.type === 'expense' ? '-' : '+'}
                              {CURRENCY_FORMATTER.format(tx.amount ?? 0)}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                            <span className="rounded-full bg-slate-900/60 px-2 py-1">
                              Kategori {tx.category_id ? tx.category_id : 'Tidak ada'}
                            </span>
                            <span className="rounded-full bg-slate-900/60 px-2 py-1">
                              Akun {tx.account_id ? tx.account_id : 'Tidak ada'}
                            </span>
                            {tx.merchant_id ? (
                              <span className="rounded-full bg-slate-900/60 px-2 py-1">
                                Merchant {tx.merchant_id}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(tx.id)}
                              className="inline-flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-2xl bg-brand/20 px-4 text-sm font-semibold text-white transition hover:bg-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                              aria-label="Edit transaksi"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </button>
                            {tx.receipt_url ? (
                              <a
                                href={tx.receipt_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-2xl border border-border/60 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                                aria-label="Lihat nota"
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                Lihat nota
                              </a>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleDelete(tx.id)}
                              className="inline-flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-2xl border border-rose-500/70 px-4 text-sm font-semibold text-rose-300 transition hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                              aria-label="Hapus transaksi"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Hapus
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-border/60 bg-surface-2/60 p-8 text-center text-sm text-slate-400">
                      Tidak ada transaksi.
                    </div>
                  )}
                </div>
                <div className="border-t border-border/60 bg-surface-2 px-4 py-3 text-right text-xs text-slate-500">
                  {isFetching ? 'Memuat data terbaru…' : `${summary?.count ?? 0} transaksi pada tanggal ini`}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
