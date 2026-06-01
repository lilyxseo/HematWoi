import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import Page from '../layout/Page.jsx';
import PageHeader from '../layout/PageHeader.jsx';
import useSupabaseUser from '../hooks/useSupabaseUser';
import { listAccounts, type AccountRecord } from '../lib/api';
import type { Category } from '../services/categories';
import { listTransactions, deleteTransaction, type Tx } from '../services/transactions';
import EditTransactionForm from '../components/EditTransactionForm';

const PAGE_SIZE = 20;

const DATE_FORMATTER =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })
    : null;

const AMOUNT_FORMATTER =
  typeof Intl !== 'undefined'
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })
    : null;

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return DATE_FORMATTER ? DATE_FORMATTER.format(date) : date.toISOString().slice(0, 10);
  } catch {
    return value;
  }
}

function formatAmount(value: number | null): string {
  if (!value) return 'Rp 0';
  if (AMOUNT_FORMATTER) {
    return AMOUNT_FORMATTER.format(value);
  }
  return `Rp ${value.toLocaleString('id-ID')}`;
}

type TransactionTypeFilter = 'all' | 'expense' | 'income' | 'transfer';

type FiltersState = {
  startDate: string;
  endDate: string;
  type: TransactionTypeFilter;
  accountId: string;
  search: string;
};

function getCurrentMonthRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const toIso = (date: Date) => date.toISOString().slice(0, 10);
  return { start: toIso(start), end: toIso(end) };
}

function buildCategoryName(
  tx: Tx,
  categories: Record<string, Category>,
): string {
  if (tx.type === 'transfer') return 'Transfer';
  if (!tx.category_id) return 'Tanpa kategori';
  const category = categories[tx.category_id];
  return category ? category.name : 'Tanpa kategori';
}

function buildTypeBadgeClass(type: Tx['type']): string {
  switch (type) {
    case 'income':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40';
    case 'expense':
      return 'bg-rose-500/10 text-rose-300 border-rose-500/40';
    default:
      return 'bg-sky-500/10 text-sky-300 border-sky-500/40';
  }
}

export default function TransactionsPage() {
  const { user, loading: userLoading } = useSupabaseUser();
  const [filters, setFilters] = useState<FiltersState>(() => {
    const { start, end } = getCurrentMonthRange();
    return {
      startDate: start,
      endDate: end,
      type: 'all',
      accountId: 'all',
      search: '',
    };
  });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Tx[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const accountFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Semua akun' },
      ...accounts.map((account) => ({ value: account.id, label: account.name || 'Tanpa nama' })),
    ];
  }, [accounts]);

  const handleFiltersChange = useCallback(
    (patch: Partial<FiltersState>) => {
      setFilters((prev) => ({ ...prev, ...patch }));
      setPage(1);
    },
    [],
  );

  const loadAccounts = useCallback(async () => {
    if (!user?.id) {
      setAccounts([]);
      return;
    }
    setAccountsLoading(true);
    try {
      const rows = await listAccounts(user.id);
      setAccounts(rows);
    } catch (error) {
      console.error('[transactions:list] Failed to load accounts for filters', error);
    } finally {
      setAccountsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (userLoading) return;
    void loadAccounts();
  }, [loadAccounts, userLoading]);

  const loadTransactions = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setCategories({});
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await listTransactions({
        page,
        limit: PAGE_SIZE,
        startDate: filters.startDate,
        endDate: filters.endDate,
        type: filters.type,
        accountId: filters.accountId === 'all' ? null : filters.accountId,
        search: filters.search || null,
      });
      setRows(result.rows);
      setTotal(result.total);
      setCategories(result.categories ?? {});
    } catch (err) {
      console.error('[transactions:list] Failed to load transactions', err);
      setError('Gagal memuat transaksi. Silakan coba lagi.');
      setRows([]);
      setTotal(0);
      setCategories({});
    } finally {
      setLoading(false);
    }
  }, [filters.accountId, filters.endDate, filters.search, filters.startDate, filters.type, page, user?.id]);

  useEffect(() => {
    if (userLoading) return;
    void loadTransactions();
  }, [loadTransactions, userLoading]);

  const handleEdit = useCallback((id: string) => {
    setSelectedTransactionId(id);
    setEditOpen(true);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditOpen(false);
    setSelectedTransactionId(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!id) return;
      const confirm = window.confirm('Hapus transaksi ini?');
      if (!confirm) return;
      setDeletingId(id);
      try {
        await deleteTransaction(id);
        await loadTransactions();
      } catch (error) {
        console.error('[transactions:update] Failed to delete transaction', error);
        alert('Gagal menghapus transaksi.');
      } finally {
        setDeletingId(null);
      }
    },
    [loadTransactions],
  );

  const totalPages = useMemo(() => {
    if (total === 0) return 1;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const categoryNameById = categories;

  const handleEditSaved = useCallback(() => {
    void loadTransactions();
  }, [loadTransactions]);

  return (
    <Page>
      <PageHeader title="Transaksi" description="Kelola transaksi dan catat aktivitas keuangan Anda.">
        <Link
          to="/transaction/add"
          className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          Tambah Transaksi
        </Link>
      </PageHeader>

      <section className="mb-6 space-y-4 rounded-3xl border border-slate-800 bg-slate-950/60 p-4 shadow-lg shadow-slate-950/30">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="font-semibold text-slate-200">Dari tanggal</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => handleFiltersChange({ startDate: event.target.value })}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="font-semibold text-slate-200">Sampai tanggal</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => handleFiltersChange({ endDate: event.target.value })}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="font-semibold text-slate-200">Tipe transaksi</span>
            <select
              value={filters.type}
              onChange={(event) => handleFiltersChange({ type: event.target.value as TransactionTypeFilter })}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <option value="all">Semua</option>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="font-semibold text-slate-200">Akun</span>
            <select
              value={filters.accountId}
              onChange={(event) => handleFiltersChange({ accountId: event.target.value })}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              disabled={accountsLoading}
            >
              {accountFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label className="flex flex-col gap-2 text-sm text-slate-300 md:flex-row md:items-center md:gap-3">
            <span className="font-semibold text-slate-200">Pencarian</span>
            <input
              type="search"
              placeholder="Cari judul, merchant, atau catatan"
              value={filters.search}
              onChange={(event) => handleFiltersChange({ search: event.target.value })}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:max-w-md"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/50 shadow-xl shadow-slate-950/30">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Judul</th>
                <th className="px-4 py-3">Akun</th>
                <th className="px-4 py-3 text-right">Jumlah</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm text-slate-200">
              {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="animate-pulse bg-slate-900/40">
                      <td className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-slate-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-20 rounded bg-slate-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-28 rounded bg-slate-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-32 rounded bg-slate-800" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-slate-800" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="ml-auto h-4 w-20 rounded bg-slate-800" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="ml-auto h-8 w-16 rounded bg-slate-800" />
                      </td>
                    </tr>
                  ))
                : rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={7}>
                        {error ?? 'Tidak ada transaksi pada rentang ini.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((tx) => {
                      const categoryName = buildCategoryName(tx, categoryNameById);
                      const accountName = accounts.find((acc) => acc.id === tx.account_id)?.name ?? '-';
                      const toAccountName =
                        tx.type === 'transfer'
                          ? accounts.find((acc) => acc.id === tx.to_account_id)?.name ?? '-'
                          : null;
                      return (
                        <tr key={tx.id} className="transition hover:bg-slate-900/40">
                          <td className="px-4 py-3">{formatDate(tx.date)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={clsx(
                                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                                buildTypeBadgeClass(tx.type),
                              )}
                            >
                              {tx.type === 'income'
                                ? 'Pemasukan'
                                : tx.type === 'expense'
                                ? 'Pengeluaran'
                                : 'Transfer'}
                            </span>
                          </td>
                          <td className="px-4 py-3">{categoryName}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-white">
                                {tx.title?.trim() || '(Tanpa judul)'}
                              </span>
                              {tx.notes ? (
                                <span className="text-xs text-slate-400">{tx.notes}</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {tx.type === 'transfer' && toAccountName
                              ? `${accountName} → ${toAccountName}`
                              : accountName}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            <span
                              className={clsx(
                                tx.type === 'income'
                                  ? 'text-emerald-300'
                                  : tx.type === 'expense'
                                  ? 'text-rose-300'
                                  : 'text-sky-300',
                              )}
                            >
                              {formatAmount(tx.amount)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEdit(tx.id)}
                                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(tx.id)}
                                className="rounded-full border border-rose-500/50 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-60"
                                disabled={deletingId === tx.id}
                              >
                                {deletingId === tx.id ? 'Menghapus…' : 'Hapus'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-4 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
          <div>
            Menampilkan{' '}
            <span className="font-semibold text-white">
              {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} -
              {Math.min(page * PAGE_SIZE, total)}
            </span>{' '}
            dari <span className="font-semibold text-white">{total}</span> transaksi
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sebelumnya
            </button>
            <span>
              Halaman <span className="font-semibold text-white">{page}</span> dari{' '}
              <span className="font-semibold text-white">{totalPages}</span>
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </section>

      <EditTransactionForm
        transactionId={selectedTransactionId}
        open={editOpen}
        onClose={handleCloseEdit}
        onSaved={handleEditSaved}
        accounts={accounts}
      />
    </Page>
  );
}

