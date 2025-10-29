import { Fragment, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Loader2, Pencil, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { CalendarFilters } from '../../lib/calendarApi';
import { useDayTransactions } from '../../hooks/useDayTransactions';
import { removeTransaction } from '../../lib/api-transactions';

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface DayDetailModalProps {
  date: string | null;
  open: boolean;
  onClose: () => void;
  filters: CalendarFilters;
  categoryLookup: Map<string, string>;
  accountLookup: Map<string, string>;
}

export default function DayDetailModal({
  date,
  open,
  onClose,
  filters,
  categoryLookup,
  accountLookup,
}: DayDetailModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const dayQuery = useDayTransactions(open ? date : null, filters);

  const { expense, income } = useMemo(() => {
    const rows = dayQuery.data ?? [];
    return rows.reduce(
      (acc, row) => {
        if (row.type === 'expense') {
          acc.expense += row.amount;
        } else if (row.type === 'income') {
          acc.income += row.amount;
        }
        return acc;
      },
      { expense: 0, income: 0 },
    );
  }, [dayQuery.data]);

  const formattedDate = date
    ? format(new Date(date), "EEEE, d MMMM yyyy", { locale: localeId })
    : '';

  const handleEdit = (id: string) => {
    navigate('/transactions', { state: { focusTransactionId: id, focusDate: date } });
    onClose();
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Hapus transaksi ini?');
    if (!confirmed) return;
    try {
      setDeletingId(id);
      const success = await removeTransaction(id);
      if (success) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['calendar'] }),
        ]);
      }
    } catch (error) {
      console.error('[calendar:delete]', error);
      alert('Gagal menghapus transaksi. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  const transactions = dayQuery.data ?? [];

  return (
    <Transition appear show={open} as={Fragment}>
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
          <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full justify-end sm:items-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="translate-x-full opacity-0"
              enterTo="translate-x-0 opacity-100"
              leave="ease-in duration-150"
              leaveFrom="translate-x-0 opacity-100"
              leaveTo="translate-x-full opacity-0"
            >
              <Dialog.Panel className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-surface-1 text-slate-100 shadow-2xl sm:h-auto sm:max-w-md sm:rounded-l-3xl">
                <header className="flex items-start justify-between border-b border-border/60 bg-surface-2/60 px-4 py-4 sm:px-6">
                  <div>
                    <Dialog.Title className="text-lg font-semibold">
                      {formattedDate || 'Detail transaksi'}
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-slate-400">
                      Pengeluaran {formatter.format(expense)} · Pemasukan {formatter.format(income)} · Net {formatter.format(income - expense)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1 text-slate-300 transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={onClose}
                    aria-label="Tutup detail"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                  {dayQuery.isLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`skeleton-${index}`}
                          className="h-24 animate-pulse rounded-2xl bg-surface-2/70"
                        />
                      ))}
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center text-sm text-slate-400">
                      <CheckCircle2 className="h-8 w-8 text-[color:var(--accent)]" aria-hidden="true" />
                      Tidak ada transaksi
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-4">
                      {transactions.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-2xl border border-border/70 bg-surface-2/70 p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-100">
                                {item.title || item.notes || 'Tanpa judul'}
                              </p>
                              <p className="text-xs text-slate-400">
                                {item.category_id
                                  ? `Kategori: ${categoryLookup.get(item.category_id) ?? 'Tanpa nama'}`
                                  : 'Tanpa kategori'}
                              </p>
                              {item.notes ? (
                                <p className="mt-1 text-sm text-slate-300">
                                  {item.notes}
                                </p>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <p
                                className={clsx(
                                  'font-mono text-base',
                                  item.type === 'expense'
                                    ? 'text-rose-400'
                                    : 'text-emerald-400',
                                )}
                              >
                                {item.type === 'expense' ? '-' : '+'}
                                {formatter.format(item.amount)}
                              </p>
                              {item.account_id ? (
                                <p className="text-xs text-slate-400">
                                  Akun: {accountLookup.get(item.account_id) ?? 'Tanpa nama'}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(item.id)}
                              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </button>
                            {item.receipt_url ? (
                              <a
                                href={item.receipt_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                Lihat nota
                              </a>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingId === item.id}
                              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-70"
                            >
                              {deletingId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              )}
                              Hapus
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
