import { Fragment, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDayTransactions } from '../../hooks/useDayTransactions';
import type {
  CalendarDebtRow,
  CalendarItemRow,
  NormalizedCalendarFilters,
} from '../../lib/calendarApi';
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

function isDebtItem(item: CalendarItemRow): item is CalendarDebtRow {
  return item.kind === 'debt';
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

  const items = dayQuery.data ?? [];
  const isLoading = dayQuery.isLoading || dayQuery.isFetching;
  const isDebtMode = filters.mode === 'debts';

  const totals = useMemo(() => {
    return (items as CalendarItemRow[]).reduce(
      (acc, item) => {
        if (item.kind === 'transaction') {
          if (item.type === 'expense') {
            acc.expense += item.amount;
          } else if (item.type === 'income') {
            acc.income += item.amount;
          }
        } else if (isDebtItem(item)) {
          acc.debt += item.amount;
        }
        acc.count += 1;
        return acc;
      },
      { expense: 0, income: 0, debt: 0, count: 0 },
    );
  }, [items]);

  const net = totals.income - totals.expense;
  const debtTotal = totals.debt;

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

  const handleViewDebt = (id: string) => {
    if (!id) return;
    onClose();
    navigate(`/debts?focus=${id}`);
  };

  const formattedDate = date
    ? format(new Date(`${date}T00:00:00`), 'EEEE, dd MMMM yyyy', { locale: localeId })
    : '';

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[120]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/80" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center px-4 py-6 text-center sm:items-center sm:p-6 lg:justify-end">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="translate-y-8 opacity-0 sm:translate-y-0 sm:scale-95"
              enterTo="translate-y-0 opacity-100 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 sm:scale-100"
              leaveTo="opacity-0 sm:translate-y-4 sm:scale-95"
            >
              <Dialog.Panel className="flex h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-left align-middle shadow-xl transition-all sm:h-[80vh] lg:mr-4 lg:h-[88vh]">
                <div className="flex items-start justify-between border-b border-slate-800 px-4 py-4 sm:px-6">
                  <div className="min-w-0">
                    <Dialog.Title className="text-lg font-semibold text-slate-100">
                      {formattedDate || 'Detail harian'}
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-slate-400">
                      {totals.count > 0
                        ? `${totals.count} ${isDebtMode ? 'hutang' : 'transaksi'}`
                        : isDebtMode
                        ? 'Tidak ada hutang'
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

                <div className="border-b border-slate-800 px-4 py-4 sm:px-6">
                  {isDebtMode ? (
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Total hutang
                        </dt>
                        <dd className="mt-1 text-sm font-mono text-amber-300">
                          -{formatCurrency(debtTotal)}
                        </dd>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Jumlah hutang
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-100">{totals.count}</dd>
                      </div>
                    </dl>
                  ) : (
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expense</dt>
                        <dd className="mt-1 text-sm font-mono text-rose-400">
                          -{formatCurrency(totals.expense)}
                        </dd>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Income</dt>
                        <dd className="mt-1 text-sm font-mono text-emerald-400">
                          +{formatCurrency(totals.income)}
                        </dd>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Net</dt>
                        <dd
                          className={`mt-1 text-sm font-mono ${
                            net >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {net >= 0 ? '+' : ''}
                          {formatCurrency(net)}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                  {dayQuery.isError ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                      <p>Gagal memuat data. Coba lagi?</p>
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
                          className="h-24 animate-pulse rounded-2xl bg-slate-900/60"
                        />
                      ))}
                    </div>
                  ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
                      {isDebtMode ? 'Tidak ada hutang' : 'Tidak ada transaksi'}
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-4">
                      {items.map((item) => {
                        if (!isDebtItem(item)) {
                          const categoryName = item.category_id
                            ? categoryMap.get(item.category_id)?.name ?? 'Tanpa kategori'
                            : 'Tanpa kategori';
                          const accountName = item.account_id
                            ? accountMap.get(item.account_id)?.name ?? 'Tanpa akun'
                            : 'Tanpa akun';
                          return (
                            <li
                              key={item.id}
                              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-100">
                                    {item.title?.trim() || 'Tanpa judul'}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {categoryName} • {accountName}
                                  </p>
                                  {item.merchant_name ? (
                                    <p className="mt-1 text-xs text-slate-400">Merchant: {item.merchant_name}</p>
                                  ) : null}
                                  {item.notes ? (
                                    <p className="mt-2 text-sm text-slate-300">
                                      {item.notes}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span
                                    className={`font-mono text-sm ${
                                      item.type === 'expense' ? 'text-rose-400' : 'text-emerald-400'
                                    }`}
                                  >
                                    {item.type === 'expense' ? '-' : '+'}
                                    {formatCurrency(item.amount)}
                                  </span>
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEdit(item.id)}
                                      className="inline-flex h-9 items-center justify-center gap-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-100 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                      aria-label="Edit transaksi"
                                    >
                                      <Pencil className="h-4 w-4" /> Edit
                                    </button>
                                    {item.receipt_url ? (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenReceipt(item.receipt_url)}
                                        className="inline-flex h-9 items-center justify-center gap-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-100 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                        aria-label="Lihat nota"
                                      >
                                        <ExternalLink className="h-4 w-4" /> Nota
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(item.id)}
                                      disabled={deletingId === item.id}
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
                        }

                        const dueDateLabel = item.due_date
                          ? format(new Date(item.due_date), 'dd MMMM yyyy', { locale: localeId })
                          : 'Tanpa jatuh tempo';
                        const statusLabel =
                          item.status === 'overdue'
                            ? 'Terlambat'
                            : item.status === 'paid'
                            ? 'Lunas'
                            : 'Berjalan';
                        const statusClass =
                          item.status === 'overdue'
                            ? 'bg-rose-500/10 text-rose-200 border border-rose-500/40'
                            : item.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40'
                            : 'bg-amber-500/10 text-amber-200 border border-amber-500/40';
                        const debtTypeLabel = item.debt_type === 'receivable' ? 'Piutang' : 'Hutang';
                        return (
                          <li
                            key={item.id}
                            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-100">
                                  {item.title?.trim() || 'Tanpa judul'}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {debtTypeLabel} • {item.party_name || 'Tanpa pihak'}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">Jatuh tempo: {dueDateLabel}</p>
                                <span
                                  className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}
                                >
                                  {statusLabel}
                                </span>
                                {item.notes ? (
                                  <p className="mt-3 text-sm text-slate-300">{item.notes}</p>
                                ) : null}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className="font-mono text-sm text-amber-300">
                                  Sisa {formatCurrency(item.amount)}
                                </span>
                                <span className="text-xs text-slate-400">
                                  Total {formatCurrency(item.original_amount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleViewDebt(item.id)}
                                  className="inline-flex items-center gap-1 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                >
                                  Kelola hutang
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="border-t border-slate-800 px-4 py-4 text-right text-xs text-slate-500 sm:px-6">
                  Data ditarik sesuai filter aktif
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
