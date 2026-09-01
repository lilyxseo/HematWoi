import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../layout/Page.jsx';
import PageHeader from '../layout/PageHeader.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatCurrency } from '../lib/format.js';
import {
  deleteTransaction,
  listTransactions,
  type ListTransactionsParams,
  type Tx,
} from '../services/transactions';
import {
  fetchCategoriesByIds,
  getCurrentUserId,
  type Category,
} from '../services/categories';
import { listAccounts, type AccountRecord } from '../lib/api.ts';
import EditTransactionForm from '../components/EditTransactionForm';

const TYPE_FILTER_OPTIONS: { label: string; value: ListTransactionsParams['type'] }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

const TYPE_LABELS: Record<Tx['type'], string> = {
  expense: 'Pengeluaran',
  income: 'Pemasukan',
  transfer: 'Transfer',
};

const DATE_FORMATTER =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

type FiltersState = {
  startDate: string;
  endDate: string;
  type: ListTransactionsParams['type'];
  accountId: string;
  search: string;
};

const DEFAULT_LIMIT = 20;

type CategoryMap = Record<string, Pick<Category, 'id' | 'name' | 'type'>>;

type AccountOption = Pick<AccountRecord, 'id' | 'name'>;

export default function TransactionsPage(): JSX.Element {
  const toast = useToast();
  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const [filters, setFilters] = useState<FiltersState>({
    startDate: monthRange.start,
    endDate: monthRange.end,
    type: 'all',
    accountId: '',
    search: '',
  });
  const [page, setPage] = useState(0);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryMap, setCategoryMap] = useState<CategoryMap>({});
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    if (!total) return 1;
    return Math.max(1, Math.ceil(total / DEFAULT_LIMIT));
  }, [total]);

  const paginatedSummary = useMemo(() => {
    if (!total) {
      return '0 transaksi';
    }
    const start = page * DEFAULT_LIMIT + 1;
    const end = Math.min(total, (page + 1) * DEFAULT_LIMIT);
    return `${start}-${end} dari ${total}`;
  }, [page, total]);

  const loadAccounts = useCallback(async () => {
    setIsAccountsLoading(true);
    try {
      const userId = await getCurrentUserId();
      const rows = await listAccounts(userId);
      setAccounts(rows.map((row) => ({ id: row.id, name: row.name })));
    } catch (error) {
      console.error('[transactions:accounts] Failed to load accounts', error);
      toast?.addToast?.('Gagal memuat daftar akun.', 'error');
    } finally {
      setIsAccountsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: ListTransactionsParams = {
        startDate: filters.startDate,
        endDate: filters.endDate,
        type: filters.type,
        accountId: filters.accountId || undefined,
        search: filters.search.trim() || undefined,
        limit: DEFAULT_LIMIT,
        offset: page * DEFAULT_LIMIT,
      };

      const { rows, total } = await listTransactions(params);
      setTransactions(rows);
      setTotal(total);

      const categoryIds = Array.from(
        new Set(
          rows
            .map((row) => row.category_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      if (categoryIds.length) {
        try {
          const categories = await fetchCategoriesByIds(categoryIds);
          const map: CategoryMap = {};
          categories.forEach((item) => {
            map[item.id] = { id: item.id, name: item.name, type: item.type };
          });
          setCategoryMap(map);
        } catch (catError) {
          console.error('[transactions:list] Failed to enrich categories', catError);
          setCategoryMap({});
        }
      } else {
        setCategoryMap({});
      }
    } catch (error) {
      console.error('[transactions:list] Failed to load transactions', error);
      setError(error instanceof Error ? error.message : 'Gagal memuat transaksi.');
      setTransactions([]);
      setTotal(0);
      setCategoryMap({});
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const handleFilterChange = useCallback(
    <K extends keyof FiltersState,>(key: K, value: FiltersState[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
      setPage(0);
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!id) return;
      const confirmed = window.confirm('Hapus transaksi ini?');
      if (!confirmed) return;

      setIsDeletingId(id);
      try {
        await deleteTransaction(id);
        toast?.addToast?.('Transaksi dihapus.', 'success');
        await loadTransactions();
      } catch (error) {
        console.error('[transactions:delete] Failed to delete transaction', error);
        toast?.addToast?.('Gagal menghapus transaksi.', 'error');
      } finally {
        setIsDeletingId(null);
      }
    },
    [loadTransactions, toast],
  );

  const handleEditSaved = useCallback(async () => {
    setEditingId(null);
    await loadTransactions();
  }, [loadTransactions]);

  const accountOptions = useMemo(() => {
    return accounts;
  }, [accounts]);

  const accountNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    accounts.forEach((account) => {
      map[account.id] = account.name;
    });
    return map;
  }, [accounts]);

  return (
    <Page>
      <PageHeader
        title="Transaksi"
        description="Kelola transaksi keuangan, filter data, dan lakukan perubahan dengan mudah."
        actions={
          <Link
            to="/transaction/add"
            className="inline-flex items-center rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Tambah Transaksi
          </Link>
        }
      />

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Dari Tanggal
            <input
              type="date"
              value={filters.startDate}
              max={filters.endDate}
              onChange={(event) => handleFilterChange('startDate', event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Sampai Tanggal
            <input
              type="date"
              value={filters.endDate}
              min={filters.startDate}
              onChange={(event) => handleFilterChange('endDate', event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-base"
            />
          </label>
          <div className="flex flex-col gap-2 text-sm font-medium">
            Tipe
            <div className="flex flex-wrap gap-2">
              {TYPE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFilterChange('type', option.value)}
                  className={`rounded px-3 py-2 text-sm font-medium transition ${
                    filters.type === option.value
                      ? 'bg-primary text-white'
                      : 'border border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Akun
            <select
              value={filters.accountId}
              onChange={(event) => handleFilterChange('accountId', event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-base"
              disabled={isAccountsLoading}
            >
              <option value="">Semua akun</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4">
          <input
            type="search"
            value={filters.search}
            placeholder="Cari judul, merchant, atau catatan"
            onChange={(event) => handleFilterChange('search', event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-base"
          />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="text-sm text-muted-foreground">{paginatedSummary}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              className="rounded border border-gray-300 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={page === 0 || isLoading}
            >
              Sebelumnya
            </button>
            <span className="text-sm text-gray-600">
              Halaman {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded border border-gray-300 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading || page + 1 >= totalPages}
            >
              Selanjutnya
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">Belum ada transaksi pada rentang ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Tipe
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Kategori
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Judul
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Akun
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Jumlah
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {transactions.map((transaction) => {
                  const dateValue = (() => {
                    try {
                      const parsed = new Date(transaction.date);
                      if (Number.isNaN(parsed.getTime())) return transaction.date;
                      return DATE_FORMATTER ? DATE_FORMATTER.format(parsed) : transaction.date;
                    } catch {
                      return transaction.date;
                    }
                  })();
                  const category = transaction.category_id
                    ? categoryMap[transaction.category_id]
                    : null;
                  const amountLabel = formatCurrency(transaction.amount, 'IDR');

                  const accountLabel = (() => {
                    const from = transaction.account_id
                      ? accountNameMap[transaction.account_id] ?? transaction.account_id
                      : '—';
                    if (transaction.type !== 'transfer') {
                      return from || '—';
                    }
                    const to = transaction.to_account_id
                      ? accountNameMap[transaction.to_account_id] ?? transaction.to_account_id
                      : '—';
                    return `${from || '—'} → ${to || '—'}`;
                  })();

                  return (
                    <tr key={transaction.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{dateValue}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{TYPE_LABELS[transaction.type]}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {transaction.type === 'transfer'
                          ? 'Transfer'
                          : category?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {transaction.title || transaction.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{accountLabel}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        {amountLabel}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
                            onClick={() => setEditingId(transaction.id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => handleDelete(transaction.id)}
                            disabled={isDeletingId === transaction.id}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingId && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
            onClick={() => setEditingId(null)}
          />
          <div className="relative ml-auto h-full w-full max-w-xl bg-white shadow-xl">
            <EditTransactionForm
              transactionId={editingId}
              onCancel={() => setEditingId(null)}
              onSaved={handleEditSaved}
              accounts={accountOptions}
            />
          </div>
        </div>
      )}
    </Page>
  );
}
