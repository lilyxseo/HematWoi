import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Trash2, Plus, RotateCcw } from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import Segmented from '../components/ui/Segmented.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { formatCurrency } from '../lib/format';
import { listAccounts, type AccountRecord } from '../lib/api';
import useSupabaseUser from '../hooks/useSupabaseUser';
import { useToast } from '../context/ToastContext';
import EditTransactionForm from '../components/EditTransactionForm';
import {
  deleteTransaction,
  listTransactions,
  type ListTransactionsParams,
  type Tx,
} from '../services/transactions';
import {
  fetchCategoriesRaw,
  fetchCategoryById,
  type Category,
} from '../services/categories';

type TransactionFilterType = 'all' | 'expense' | 'income' | 'transfer';

interface Filters {
  startDate: string;
  endDate: string;
  type: TransactionFilterType;
  accountId: string;
  search: string;
}

const PAGE_SIZE = 20;

const TYPE_FILTER_OPTIONS: { value: TransactionFilterType; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('id-ID');
}

function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toISO = (date: Date) => date.toISOString().slice(0, 10);
  return { start: toISO(start), end: toISO(end) };
}

export default function TransactionsPage(): JSX.Element {
  const { user, loading: userLoading } = useSupabaseUser();
  const { addToast } = useToast();
  const [filters, setFilters] = useState<Filters>(() => {
    const range = currentMonthRange();
    return {
      startDate: range.start,
      endDate: range.end,
      type: 'all',
      accountId: '',
      search: '',
    };
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [categoriesMap, setCategoriesMap] = useState<Map<string, Category>>(new Map());
  const [editOpen, setEditOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!user?.id) {
      setAccounts([]);
      return;
    }
    setAccountsLoading(true);
    try {
      const rows = await listAccounts(user.id);
      setAccounts(rows);
    } catch (err) {
      console.error('[transactions:list] Failed to load accounts', err);
      addToast('Gagal memuat daftar akun.', 'error');
    } finally {
      setAccountsLoading(false);
    }
  }, [addToast, user?.id]);

  const fetchBaseCategories = useCallback(async () => {
    if (!user?.id) {
      setCategoriesMap(new Map());
      return;
    }
    try {
      const rows = await fetchCategoriesRaw({ types: ['expense', 'income'], order: true });
      const map = new Map<string, Category>();
      rows.forEach((category) => {
        map.set(category.id, category);
      });
      setCategoriesMap(map);
    } catch (err) {
      console.error('[categories:raw] Failed to load categories for list', err);
      setCategoriesMap(new Map());
    }
  }, [user?.id]);

  const fetchTransactionsList = useCallback(async () => {
    if (userLoading) return;
    if (!user?.id) {
      setTransactions([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError(null);
    const params: ListTransactionsParams = {
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      type: filters.type === 'all' ? undefined : filters.type,
      accountId: filters.accountId || undefined,
      search: filters.search.trim(),
    };
    try {
      const { rows, total } = await listTransactions(params);
      setTransactions(rows);
      setTotal(total);
    } catch (err) {
      console.error('[transactions:list] Failed to load transactions', err);
      setError('Gagal memuat transaksi. Silakan coba lagi.');
      setTransactions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters.accountId, filters.endDate, filters.search, filters.startDate, filters.type, page, user?.id, userLoading]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    void fetchBaseCategories();
  }, [fetchBaseCategories]);

  useEffect(() => {
    void fetchTransactionsList();
  }, [fetchTransactionsList]);

  useEffect(() => {
    const missingIds = Array.from(
      new Set(
        transactions
          .map((tx) => tx.category_id)
          .filter((id): id is string => Boolean(id) && !categoriesMap.has(id as string)),
      ),
    );
    if (!missingIds.length) {
      return;
    }
    let active = true;
    (async () => {
      try {
        const results = await Promise.all(missingIds.map((id) => fetchCategoryById(id)));
        if (!active) return;
        setCategoriesMap((prev) => {
          const next = new Map(prev);
          results.forEach((category) => {
            if (category) {
              next.set(category.id, category);
            }
          });
          return next;
        });
      } catch (err) {
        console.error('[categories:byId] Failed to load categories for transactions', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [categoriesMap, transactions]);

  const categoryName = useCallback(
    (categoryId: string | null): string => {
      if (!categoryId) return '-';
      const data = categoriesMap.get(categoryId);
      return data ? data.name : 'Kategori tidak tersedia';
    },
    [categoriesMap],
  );

  const accountName = useCallback(
    (accountId: string | null): string => {
      if (!accountId) return '-';
      const account = accounts.find((item) => item.id === accountId);
      return account?.name ?? '-';
    },
    [accounts],
  );

  const accountOptions = useMemo(() => {
    const base = accounts.map((account) => ({ value: account.id, label: account.name ?? '(Tanpa nama)' }));
    const label = accountsLoading ? 'Memuat akun...' : 'Semua akun';
    return [{ value: '', label }, ...base];
  }, [accounts, accountsLoading]);

  const typeLabel = useCallback((type: Tx['type']): string => {
    switch (type) {
      case 'income':
        return 'Pemasukan';
      case 'expense':
        return 'Pengeluaran';
      case 'transfer':
        return 'Transfer';
      default:
        return type;
    }
  }, []);

  const handleFilterChange = useCallback(
    (partial: Partial<Filters>) => {
      setFilters((prev) => ({ ...prev, ...partial }));
      setPage(1);
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    const range = currentMonthRange();
    setFilters({
      startDate: range.start,
      endDate: range.end,
      type: 'all',
      accountId: '',
      search: '',
    });
    setPage(1);
  }, []);

  const handleEdit = useCallback((id: string) => {
    setEditTargetId(id);
    setEditOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (deleteBusyId) return;
      const confirmed = window.confirm('Hapus transaksi ini?');
      if (!confirmed) return;
      setDeleteBusyId(id);
      try {
        await deleteTransaction(id);
        addToast('Transaksi dihapus.', 'success');
        await fetchTransactionsList();
      } catch (err) {
        console.error('[transactions:update] Failed to delete transaction', err);
        addToast('Gagal menghapus transaksi.', 'error');
      } finally {
        setDeleteBusyId(null);
      }
    },
    [addToast, deleteBusyId, fetchTransactionsList],
  );

  const handleEditSaved = useCallback(
    (updated: Tx) => {
      setEditOpen(false);
      setEditTargetId(null);
      setTransactions((prev) => prev.map((tx) => (tx.id === updated.id ? updated : tx)));
      void fetchTransactionsList();
      addToast('Transaksi diperbarui.', 'success');
    },
    [addToast, fetchTransactionsList],
  );

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setEditTargetId(null);
  }, []);

  const totalPages = useMemo(() => {
    return total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  }, [total]);

  const paginationRange = useMemo(() => {
    if (total === 0) {
      return { start: 0, end: 0 };
    }
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + transactions.length - 1, total);
    return { start, end };
  }, [page, total, transactions.length]);

  const isInitialLoading = loading && transactions.length === 0;

  return (
    <Page>
      <PageHeader title="Transaksi" description="Kelola transaksi kamu">
        <Link to="/transaction/add" className="btn btn-primary">
          <Plus className="mr-2 h-4 w-4" /> Tambah Transaksi
        </Link>
      </PageHeader>

      <section className="mb-8 rounded-3xl bg-surface p-4 ring-1 ring-border-subtle">
        <div className="grid gap-4 lg:grid-cols-4">
          <Input
            label="Dari tanggal"
            type="date"
            value={filters.startDate}
            onChange={(event) => handleFilterChange({ startDate: event.target.value })}
          />
          <Input
            label="Sampai tanggal"
            type="date"
            value={filters.endDate}
            onChange={(event) => handleFilterChange({ endDate: event.target.value })}
          />
          <Select
            label="Akun"
            value={filters.accountId}
            onChange={(event) => handleFilterChange({ accountId: event.target.value })}
            options={accountOptions}
            placeholder="Pilih akun"
          />
          <Input
            label="Pencarian"
            value={filters.search}
            onChange={(event) => handleFilterChange({ search: event.target.value })}
            placeholder="Judul, merchant, catatan"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={filters.type}
            onChange={(value) => handleFilterChange({ type: value as TransactionFilterType })}
            options={TYPE_FILTER_OPTIONS}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void fetchTransactionsList()}
              disabled={loading}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Muat ulang
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleResetFilters}>
              Reset
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="mb-4 rounded-3xl bg-red-500/10 p-4 text-sm text-red-200 ring-1 ring-red-500/30">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl bg-surface ring-1 ring-border-subtle">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
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
          <tbody className="divide-y divide-border-subtle">
            {isInitialLoading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3" colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              : transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3">{typeLabel(tx.type)}</td>
                    <td className="px-4 py-3">{tx.type === 'transfer' ? 'Transfer' : categoryName(tx.category_id)}</td>
                    <td className="px-4 py-3">{tx.title || '-'}</td>
                    <td className="px-4 py-3">
                      {tx.type === 'transfer'
                        ? `${accountName(tx.account_id)} → ${accountName(tx.to_account_id)}`
                        : accountName(tx.account_id)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {tx.type === 'income'
                        ? `+${formatCurrency(tx.amount)}`
                        : tx.type === 'expense'
                          ? `-${formatCurrency(tx.amount)}`
                          : formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleEdit(tx.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-danger"
                          onClick={() => void handleDelete(tx.id)}
                          disabled={deleteBusyId === tx.id}
                        >
                          {deleteBusyId === tx.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            {!isInitialLoading && transactions.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  {filters.search || filters.accountId || filters.type !== 'all'
                    ? 'Tidak ada transaksi yang sesuai filter.'
                    : 'Belum ada transaksi pada rentang tanggal ini.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 text-sm text-muted">
          <div>
            Menampilkan {paginationRange.start}–{paginationRange.end} dari {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1 || loading}
            >
              Sebelumnya
            </button>
            <span>
              Halaman {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      <EditTransactionForm
        open={editOpen}
        transactionId={editTargetId}
        accounts={accounts}
        onClose={handleEditClose}
        onSaved={handleEditSaved}
      />
    </Page>
  );
}
