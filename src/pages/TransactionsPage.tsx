import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import Page from '../layout/Page.jsx';
import PageHeader from '../layout/PageHeader.jsx';
import { useToast } from '../context/ToastContext';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import Card, { CardBody } from '../components/Card.jsx';
import useSupabaseUser from '../hooks/useSupabaseUser';
import EditTransactionForm from '../components/EditTransactionForm';
import type { Tx } from '../services/transactions';
import {
  deleteTransaction,
  listTransactions,
} from '../services/transactions';
import type { Category } from '../services/categories';
import { fetchCategoriesRaw, fetchCategoryById } from '../services/categories';
import { listAccounts, type AccountRecord } from '../lib/api';

const PAGE_SIZE = 20;

const TYPE_FILTERS: { value: 'all' | Tx['type']; label: string }[] = [
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

function getMonthRange(): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const toIso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: toIso(start), to: toIso(end) };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(parsed);
}

type FiltersState = {
  from: string;
  to: string;
  type: 'all' | Tx['type'];
  accountId: string;
  search: string;
};

type CategoryLookup = Record<string, Category>;

type AccountLookup = Record<string, AccountRecord>;

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user, loading: userLoading } = useSupabaseUser();
  const [filters, setFilters] = useState<FiltersState>(() => {
    const range = getMonthRange();
    return {
      from: range.from,
      to: range.to,
      type: 'all',
      accountId: '',
      search: '',
    };
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryLookup, setCategoryLookup] = useState<CategoryLookup>({});
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const accountMap: AccountLookup = useMemo(() => {
    return accounts.reduce<AccountLookup>((map, account) => {
      map[account.id] = account;
      return map;
    }, {});
  }, [accounts]);

  const ensureCategoriesForRows = useCallback(
    async (items: Tx[]) => {
      const missingIds = Array.from(
        new Set(
          items
            .map((item) => item.category_id)
            .filter((id): id is string => Boolean(id) && !categoryLookup[id]),
        ),
      );
      if (!missingIds.length) {
        return;
      }
      const results = await Promise.all(
        missingIds.map(async (id) => {
          try {
            return await fetchCategoryById(id);
          } catch (error) {
            console.error('[categories:byId] Failed to fetch missing category', error);
            return null;
          }
        }),
      );
      const valid = results.filter((item): item is Category => Boolean(item));
      if (!valid.length) {
        return;
      }
      setCategoryLookup((prev) => {
        const next = { ...prev };
        valid.forEach((category) => {
          next[category.id] = category;
        });
        return next;
      });
    },
    [categoryLookup],
  );

  const loadTransactions = useCallback(async () => {
    if (userLoading || !user) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await listTransactions({
        from: filters.from || undefined,
        to: filters.to || undefined,
        type: filters.type,
        accountId: filters.accountId || undefined,
        search: filters.search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(response.rows);
      setTotal(response.total);
      await ensureCategoriesForRows(response.rows);
    } catch (err) {
      console.error('[transactions:list] Failed to list transactions', err);
      const message = err instanceof Error ? err.message : 'Gagal memuat transaksi.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [ensureCategoriesForRows, filters, page, user, userLoading]);

  const loadAccounts = useCallback(async () => {
    if (!user) return;
    try {
      const accountRows = await listAccounts(user.id);
      setAccounts(accountRows);
    } catch (err) {
      console.error('[transactions:list] Failed to load accounts', err);
      addToast?.('Gagal memuat akun.', 'error');
    }
  }, [addToast, user]);

  const preloadCategories = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await fetchCategoriesRaw({ types: ['expense', 'income'], order: true });
      setCategoryLookup((prev) => {
        const next = { ...prev };
        rows.forEach((category) => {
          next[category.id] = category;
        });
        return next;
      });
    } catch (error) {
      console.error('[categories:raw] Failed to preload categories', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadAccounts();
      void preloadCategories();
    }
  }, [loadAccounts, preloadCategories, user]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const handleFilterChange = useCallback(<T extends keyof FiltersState>(key: T, value: FiltersState[T]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }, []);

  const handleDateChange = useCallback(
    (key: 'from' | 'to') =>
      (event: ChangeEvent<HTMLInputElement>) => {
        handleFilterChange(key, event.target.value);
      },
    [handleFilterChange],
  );

  const handleTypeChange = useCallback(
    (value: 'all' | Tx['type']) => {
      handleFilterChange('type', value);
    },
    [handleFilterChange],
  );

  const handleAccountChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value === '__all__' ? '' : event.target.value;
      handleFilterChange('accountId', value);
    },
    [handleFilterChange],
  );

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleFilterChange('search', searchTerm.trim());
    },
    [handleFilterChange, searchTerm],
  );

  const handleResetFilters = useCallback(() => {
    const range = getMonthRange();
    setFilters({ from: range.from, to: range.to, type: 'all', accountId: '', search: '' });
    setSearchTerm('');
    setPage(0);
  }, []);

  const handleEdit = useCallback((id: string) => {
    setSelectedId(id);
    setEditOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Hapus transaksi ini?')) {
        return;
      }
      setDeletingId(id);
      try {
        await deleteTransaction(id);
        addToast?.('Transaksi dihapus.', 'success');
        if (rows.length === 1 && page > 0) {
          setPage((prev) => Math.max(prev - 1, 0));
        } else {
          void loadTransactions();
        }
      } catch (err) {
        console.error('[transactions:update] Failed to delete transaction', err);
        const message = err instanceof Error ? err.message : 'Gagal menghapus transaksi.';
        addToast?.(message, 'error');
      } finally {
        setDeletingId(null);
      }
    },
    [addToast, loadTransactions, page, rows.length],
  );

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setSelectedId(null);
  }, []);

  const handleUpdated = useCallback(
    async (_updated: Tx) => {
      await loadTransactions();
    },
    [loadTransactions],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = page + 1;

  const accountFilterOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.name || 'Tanpa nama',
      })),
    [accounts],
  );

  return (
    <Page>
      <PageHeader title="Transaksi">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/transaction/add')}
        >
          Tambah Transaksi
        </button>
      </PageHeader>

      <div className="space-y-6">
        <Card>
          <CardBody>
            <form className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4" onSubmit={handleSearchSubmit}>
              <Input label="Dari tanggal" type="date" value={filters.from} onChange={handleDateChange('from')} />
              <Input label="Sampai tanggal" type="date" value={filters.to} onChange={handleDateChange('to')} />
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted">Tipe</span>
                <div className="flex flex-wrap gap-2">
                  {TYPE_FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleTypeChange(option.value)}
                      className={clsx(
                        'rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                        filters.type === option.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border-subtle text-muted hover:border-border-strong hover:text-text',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <Select
                label="Akun"
                value={filters.accountId || '__all__'}
                onChange={handleAccountChange}
                options={[{ value: '__all__', label: 'Semua akun' }, ...accountFilterOptions]}
                placeholder="Pilih akun"
              />
              <Input label="Pencarian" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
              <div className="flex items-end gap-2">
                <button type="submit" className="btn btn-primary">
                  Terapkan
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleResetFilters}>
                  Atur ulang
                </button>
              </div>
            </form>
          </CardBody>
        </Card>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl border border-border-subtle">
          <table className="min-w-full divide-y divide-border-subtle text-sm">
            <thead className="bg-surface-alt text-left text-xs uppercase text-muted">
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
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    Belum ada transaksi untuk filter yang dipilih.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const categoryName = row.category_id ? categoryLookup[row.category_id]?.name ?? '-' : '-';
                  const sourceAccount = row.account_id ? accountMap[row.account_id]?.name ?? '-' : '-';
                  const targetAccount = row.to_account_id ? accountMap[row.to_account_id]?.name ?? '-' : '-';
                  const amountLabel = formatCurrency(row.amount);
                  const amountClass =
                    row.type === 'income'
                      ? 'text-emerald-500'
                      : row.type === 'expense'
                        ? 'text-rose-500'
                        : 'text-slate-300';
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{formatDate(row.date)}</td>
                      <td className="px-4 py-3">{TYPE_LABELS[row.type]}</td>
                      <td className="px-4 py-3">{categoryName}</td>
                      <td className="px-4 py-3">
                        <div className="max-w-[220px] truncate text-sm text-text">{row.title ?? '-'}</div>
                        {row.notes ? (
                          <div className="max-w-[220px] truncate text-xs text-muted">{row.notes}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {row.type === 'transfer' ? (
                          <div className="flex flex-col text-xs">
                            <span className="font-medium text-text">{sourceAccount}</span>
                            <span className="text-muted">→ {targetAccount}</span>
                          </div>
                        ) : (
                          sourceAccount
                        )}
                      </td>
                      <td className={clsx('px-4 py-3 text-right font-semibold', amountClass)}>{amountLabel}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleEdit(row.id)}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-red-400 hover:text-red-200"
                            onClick={() => handleDelete(row.id)}
                            disabled={deletingId === row.id}
                          >
                            {deletingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            )}
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

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <div>
            Menampilkan {rows.length === 0 ? 0 : page * PAGE_SIZE + 1} -
            {rows.length === 0 ? 0 : Math.min(total, page * PAGE_SIZE + rows.length)} dari {total} transaksi
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={currentPage <= 1}
            >
              Sebelumnya
            </button>
            <span>
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPage((prev) => (prev + 1 < totalPages ? prev + 1 : prev))}
              disabled={currentPage >= totalPages}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      <EditTransactionForm
        open={editOpen && Boolean(selectedId)}
        transactionId={selectedId}
        accounts={accounts}
        onClose={closeEdit}
        onUpdated={handleUpdated}
      />
    </Page>
  );
}
