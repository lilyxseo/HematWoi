import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Section from '../layout/Section';
import Modal from '../components/Modal.jsx';
import Select from '../components/ui/Select.jsx';
import Input from '../components/ui/Input.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useSupabaseUser from '../hooks/useSupabaseUser';
import EditTransactionForm from '../components/EditTransactionForm';
import { listAccounts, type AccountRecord } from '../lib/api';
import {
  deleteTransaction,
  listTransactions,
  type Tx,
} from '../services/transactions';
import {
  fetchCategoriesSafe,
  fetchCategoryById,
  type Category,
} from '../services/categories';

type TransactionTypeFilter = 'all' | 'expense' | 'income' | 'transfer';

type AccountFilterValue = 'all' | string;

const TYPE_LABELS: Record<Exclude<Tx['type'], never>, string> = {
  expense: 'Pengeluaran',
  income: 'Pemasukan',
  transfer: 'Transfer',
};

const TYPE_FILTER_OPTIONS: { value: TransactionTypeFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

const pageSize = 20;

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

export default function TransactionsPage() {
  const { user, loading: userLoading } = useSupabaseUser();
  const { addToast } = useToast() ?? {};
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    return formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('all');
  const [accountFilter, setAccountFilter] = useState<AccountFilterValue>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryMap, setCategoryMap] = useState<Map<string, Category>>(new Map());
  const categoryMapRef = useRef(categoryMap);

  useEffect(() => {
    categoryMapRef.current = categoryMap;
  }, [categoryMap]);

  const accountOptions = useMemo(
    () => [
      { value: 'all', label: 'Semua akun' },
      ...accounts.map((account) => ({
        value: account.id,
        label: account.name?.trim() ? account.name : 'Tanpa nama',
      })),
    ],
    [accounts],
  );

  const loadAccounts = useCallback(async () => {
    if (userLoading) {
      return;
    }
    if (!user) {
      setAccounts([]);
      return;
    }
    try {
      const rows = await listAccounts(user.id);
      setAccounts(rows);
    } catch (accountError) {
      const message =
        accountError instanceof Error
          ? accountError.message
          : 'Gagal memuat akun. Coba lagi nanti.';
      console.error('[transactions:list] Failed to load accounts', accountError);
      addToast?.(message, 'error');
    }
  }, [addToast, user, userLoading]);

  const loadCategories = useCallback(async () => {
    if (userLoading) {
      return;
    }
    if (!user) {
      setCategoryMap(new Map());
      return;
    }
    setCategoriesLoading(true);
    try {
      const rows = await fetchCategoriesSafe();
      const next = new Map<string, Category>();
      rows.forEach((category) => {
        next.set(category.id, category);
      });
      setCategoryMap(next);
    } catch (categoryError) {
      console.error('[categories:raw] Failed to pre-load categories', categoryError);
    } finally {
      setCategoriesLoading(false);
    }
  }, [user, userLoading]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const ensureCategoryInMap = useCallback(async (categoryId: string | null | undefined) => {
    if (!categoryId) return;
    if (categoryMapRef.current.has(categoryId)) {
      return;
    }
    try {
      const category = await fetchCategoryById(categoryId);
      if (category) {
        setCategoryMap((prev) => {
          const next = new Map(prev);
          next.set(category.id, category);
          return next;
        });
      }
    } catch (fetchError) {
      // Already logged inside fetchCategoryById
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    if (userLoading) {
      return;
    }
    if (!user) {
      setTransactions([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);

    const params = {
      from: dateFrom,
      to: dateTo,
      type: typeFilter === 'all' ? undefined : typeFilter,
      accountId: accountFilter === 'all' ? undefined : accountFilter,
      search: searchTerm.trim() ? searchTerm.trim() : undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    } as const;

    try {
      const { rows, total: totalCount } = await listTransactions(params);
      setTransactions(rows);
      setTotal(totalCount);

      const uniqueCategoryIds = Array.from(
        new Set(
          rows
            .map((row) => row.category_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const missingCategoryIds = uniqueCategoryIds.filter(
        (categoryId) => !categoryMapRef.current.has(categoryId),
      );

      if (missingCategoryIds.length) {
        const fetched = await Promise.all(
          missingCategoryIds.map(async (categoryId) => {
            try {
              return await fetchCategoryById(categoryId);
            } catch (fetchError) {
              return null;
            }
          }),
        );
        const validCategories = fetched.filter(
          (category): category is Category => Boolean(category),
        );
        if (validCategories.length) {
          setCategoryMap((prev) => {
            const next = new Map(prev);
            validCategories.forEach((category) => {
              next.set(category.id, category);
            });
            return next;
          });
        }
      }
    } catch (listError) {
      const message =
        listError instanceof Error ? listError.message : 'Gagal memuat transaksi. Coba lagi.';
      setError(message);
      addToast?.(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [accountFilter, addToast, dateFrom, dateTo, page, searchTerm, typeFilter, user, userLoading]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchTerm(searchInput.trim());
  };

  const handleResetFilters = () => {
    const now = new Date();
    setDateFrom(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
    setDateTo(formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    setTypeFilter('all');
    setAccountFilter('all');
    setSearchInput('');
    setSearchTerm('');
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    const confirmed = window.confirm('Hapus transaksi ini?');
    if (!confirmed) return;
    setDeletingId(id);
    try {
      await deleteTransaction(id);
      addToast?.('Transaksi berhasil dihapus.', 'success');
      await loadTransactions();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : 'Gagal menghapus transaksi. Coba lagi.';
      addToast?.(message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSuccess = async (tx: Tx) => {
    setEditOpen(false);
    setEditingId(null);
    await ensureCategoryInMap(tx.category_id);
    addToast?.('Transaksi diperbarui.', 'success');
    await loadTransactions();
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditingId(null);
  };

  const hasNextPage = page * pageSize < total;
  const hasPrevPage = page > 1;
  const displayStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const displayEnd = total === 0 ? 0 : (page - 1) * pageSize + transactions.length;

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((account) => {
      map.set(account.id, account.name?.trim() ? account.name : 'Tanpa nama');
    });
    return map;
  }, [accounts]);

  const getCategoryLabel = useCallback(
    (categoryId: string | null, type: Tx['type']): string => {
      if (!categoryId) {
        return type === 'transfer' ? '-' : 'Tidak ada';
      }
      const category = categoryMap.get(categoryId);
      if (category) {
        return category.name;
      }
      if (categoriesLoading) {
        return 'Memuat...';
      }
      return 'Tidak ditemukan';
    },
    [categoriesLoading, categoryMap],
  );

  const renderAccountLabel = (tx: Tx): string => {
    if (tx.type === 'transfer') {
      const from = tx.account_id ? accountNameById.get(tx.account_id) ?? 'Tidak diketahui' : 'Tidak ada';
      const to = tx.to_account_id
        ? accountNameById.get(tx.to_account_id) ?? 'Tidak diketahui'
        : 'Tidak ada';
      return `${from} → ${to}`;
    }
    if (!tx.account_id) {
      return 'Tidak ada';
    }
    return accountNameById.get(tx.account_id) ?? 'Tidak diketahui';
  };

  return (
    <Page>
      <PageHeader title="Transaksi">
        <Link to="/transaction/add" className="btn btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Tambah Transaksi
        </Link>
      </PageHeader>

      <Section first>
        <div className="space-y-4 rounded-3xl border border-border-subtle bg-surface-alt p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Dari Tanggal"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              max={dateTo}
            />
            <Input
              label="Sampai Tanggal"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              min={dateFrom}
            />
            <div className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
                Tipe Transaksi
              </span>
              <div className="flex overflow-hidden rounded-2xl border border-border-subtle bg-surface-alt p-1">
                {TYPE_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={clsx(
                      'flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition',
                      typeFilter === option.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted hover:bg-surface',
                    )}
                    onClick={() => {
                      setTypeFilter(option.value);
                      setPage(1);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <Select
              label="Akun"
              value={accountFilter}
              onChange={(event) => {
                const nextValue = event.target.value as AccountFilterValue;
                setAccountFilter(nextValue);
                setPage(1);
              }}
              options={accountOptions}
              placeholder="Pilih akun"
            />
          </div>
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex-1">
              <Input
                label="Pencarian"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Cari judul, merchant, atau catatan"
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="btn btn-primary">
                Cari
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleResetFilters}>
                Reset
              </button>
            </div>
          </form>
        </div>
      </Section>

      <Section>
        <div className="overflow-hidden rounded-3xl border border-border-subtle bg-surface">
          {error ? (
            <div className="border-b border-border-subtle bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}{' '}
              <button
                type="button"
                className="font-semibold underline-offset-2 hover:underline"
                onClick={() => void loadTransactions()}
              >
                Coba lagi
              </button>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle text-sm">
              <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
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
                {transactions.map((tx) => {
                  const formattedDate = tx.date ? dateFormatter.format(new Date(tx.date)) : '-';
                  const amountLabel = currencyFormatter.format(tx.amount ?? 0);
                  const amountClass =
                    tx.type === 'income'
                      ? 'text-emerald-400'
                      : tx.type === 'expense'
                        ? 'text-rose-400'
                        : 'text-text';
                  return (
                    <tr key={tx.id} className="hover:bg-surface-alt/60">
                      <td className="px-4 py-3 align-middle">{formattedDate}</td>
                      <td className="px-4 py-3 align-middle">
                        <span className="inline-flex items-center rounded-full bg-surface-alt px-2 py-0.5 text-xs font-semibold text-muted">
                          {TYPE_LABELS[tx.type] ?? tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">{getCategoryLabel(tx.category_id, tx.type)}</td>
                      <td className="px-4 py-3 align-middle">
                        <div className="max-w-xs truncate" title={tx.title ?? ''}>
                          {tx.title ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="max-w-xs truncate" title={renderAccountLabel(tx)}>
                          {renderAccountLabel(tx)}
                        </div>
                      </td>
                      <td className={clsx('px-4 py-3 text-right font-semibold', amountClass)}>
                        {amountLabel}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm inline-flex items-center gap-1"
                            onClick={() => openEdit(tx.id)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm inline-flex items-center gap-1"
                            onClick={() => void handleDelete(tx.id)}
                            disabled={deletingId === tx.id}
                          >
                            {deletingId === tx.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">
                      Tidak ada transaksi pada rentang ini.
                    </td>
                  </tr>
                ) : null}
                {loading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat transaksi...
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3 text-sm text-muted md:flex-row md:items-center md:justify-between">
            <span>
              Menampilkan {displayStart} - {displayEnd} dari {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={!hasPrevPage || loading}
              >
                Sebelumnya
              </button>
              <span className="text-xs font-semibold text-muted">Halaman {page}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((prev) => (hasNextPage ? prev + 1 : prev))}
                disabled={!hasNextPage || loading}
              >
                Selanjutnya
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Modal open={editOpen} title="Edit Transaksi" onClose={closeEdit}>
        {editingId ? (
          <EditTransactionForm
            transactionId={editingId}
            accounts={accounts}
            onCancel={closeEdit}
            onSuccess={handleEditSuccess}
          />
        ) : null}
      </Modal>
    </Page>
  );
}
