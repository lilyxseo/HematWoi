import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../layout/PageHeader.jsx';
import EditTransactionForm from '../components/EditTransactionForm';
import type { Tx } from '../services/transactions';
import { deleteTransaction, listTransactions } from '../services/transactions';
import type { Category } from '../services/categories';
import { getCurrentUserId } from '../services/categories';
import type { AccountRecord } from '../lib/api';
import { listAccounts } from '../lib/api';
import { useToast } from '../context/ToastContext.jsx';

const PAGE_SIZE = 20;

const TYPE_FILTERS: { value: Tx['type'] | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

const TYPE_BADGE_CLASS: Record<Tx['type'], string> = {
  expense: 'bg-red-500/10 text-red-600',
  income: 'bg-emerald-500/10 text-emerald-600',
  transfer: 'bg-blue-500/10 text-blue-600',
};

function getMonthBounds(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toISOString = (date: Date) => date.toISOString().slice(0, 10);
  return { from: toISOString(from), to: toISOString(to) };
}

const CURRENCY_FORMATTER =
  typeof Intl !== 'undefined'
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      })
    : null;

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '-';
  return CURRENCY_FORMATTER ? CURRENCY_FORMATTER.format(amount) : amount.toString();
}

type FilterState = {
  from: string;
  to: string;
  type: Tx['type'] | 'all';
  accountId: string;
  search: string;
};

type CategoryMap = Record<string, Category>;

export default function TransactionsPage() {
  const toast = useToast();
  const defaultDates = useMemo(() => getMonthBounds(), []);
  const [filters, setFilters] = useState<FilterState>({
    from: defaultDates.from,
    to: defaultDates.to,
    type: 'all',
    accountId: '',
    search: '',
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [categoryMap, setCategoryMap] = useState<CategoryMap>({});
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listTransactions({
        from: filters.from || undefined,
        to: filters.to || undefined,
        type: filters.type,
        accountId: filters.accountId || undefined,
        search: filters.search || undefined,
        limit: PAGE_SIZE,
        offset: currentPage * PAGE_SIZE,
        includeCategoryDetails: true,
      });
      setTransactions(result.rows);
      setCategoryMap(result.categoryMap);
      setTotal(result.total);
    } catch (err) {
      console.error('[transactions:list] Failed to load transactions', err);
      setError('Gagal memuat transaksi. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filters.accountId, filters.from, filters.search, filters.to, filters.type]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    if (currentPage > 0 && currentPage >= totalPages) {
      setCurrentPage(totalPages - 1);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      try {
        const userId = await getCurrentUserId();
        const rows = await listAccounts(userId);
        if (!active) return;
        setAccounts(rows);
      } catch (err) {
        console.error('[transactions:list] Failed to load accounts', err);
      }
    }
    void loadAccounts();
    return () => {
      active = false;
    };
  }, []);

  const handleFilterChange = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  }, []);

  const handleDelete = useCallback(
    async (transactionId: string) => {
      const confirmed = window.confirm('Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.');
      if (!confirmed) return;
      setIsDeleting(transactionId);
      try {
        await deleteTransaction(transactionId);
        toast?.addToast?.('Transaksi berhasil dihapus', 'success');
        await loadTransactions();
      } catch (err) {
        console.error('[transactions:delete] Failed to delete transaction', err);
        toast?.addToast?.('Gagal menghapus transaksi. Silakan coba lagi.', 'error');
      } finally {
        setIsDeleting(null);
      }
    },
    [loadTransactions, toast],
  );

  const handleSaved = useCallback(async () => {
    setSelectedTransactionId(null);
    await loadTransactions();
  }, [loadTransactions]);

  const handleOpenEdit = useCallback((transactionId: string) => {
    setSelectedTransactionId(transactionId);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setSelectedTransactionId(null);
  }, []);

  const paginatedInfo = useMemo(() => {
    if (!transactions.length) {
      return 'Tidak ada transaksi untuk periode ini.';
    }
    const start = currentPage * PAGE_SIZE + 1;
    const end = start + transactions.length - 1;
    return `Menampilkan ${start}-${end} dari ${total} transaksi`;
  }, [currentPage, total, transactions.length]);

  return (
    <div className="space-y-6">
      <PageHeader title="Transaksi" description="Kelola catatan keuangan Anda">
        <Link to="/transaction/add" className="btn btn-primary">
          Tambah Transaksi
        </Link>
      </PageHeader>

      <section className="card space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Dari
            <input
              type="date"
              className="input"
              value={filters.from}
              onChange={(event) => handleFilterChange('from', event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Sampai
            <input
              type="date"
              className="input"
              value={filters.to}
              onChange={(event) => handleFilterChange('to', event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-medium text-muted">
            Akun
            <select
              className="input"
              value={filters.accountId}
              onChange={(event) => handleFilterChange('accountId', event.target.value)}
            >
              <option value="">Semua akun</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-medium text-muted">
            Pencarian
            <input
              type="search"
              className="input"
              placeholder="Cari judul, merchant, atau catatan"
              value={filters.search}
              onChange={(event) => handleFilterChange('search', event.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={clsx('btn btn-sm', {
                'btn-primary': filters.type === filter.value,
                'btn-ghost': filters.type !== filter.value,
              })}
              onClick={() => handleFilterChange('type', filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        {error && !isLoading && (
          <div className="border-b border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-subtle text-sm">
            <thead className="bg-surface-dark/20">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted">Tanggal</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Tipe</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Kategori</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Judul</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Akun</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Jumlah</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">
                    Memuat transaksi...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    {error ?? 'Belum ada transaksi pada rentang waktu ini.'}
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const categoryName =
                    transaction.type === 'transfer'
                      ? '-'
                      : transaction.category_id
                        ? categoryMap[transaction.category_id]?.name ?? 'Kategori tidak tersedia'
                        : '-';
                  const accountName =
                    accounts.find((account) => account.id === transaction.account_id)?.name ?? '-';
                  const toAccountName =
                    transaction.type === 'transfer'
                      ? accounts.find((account) => account.id === transaction.to_account_id)?.name ?? '-'
                      : null;
                  return (
                    <tr key={transaction.id} className="hover:bg-surface-dark/10">
                      <td className="px-4 py-3 text-xs text-muted">
                        {new Date(transaction.date).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', TYPE_BADGE_CLASS[transaction.type])}>
                          {TYPE_FILTERS.find((filter) => filter.value === transaction.type)?.label ?? transaction.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-text">{categoryName}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-text">{transaction.title ?? '-'}</span>
                          {transaction.notes && <span className="text-xs text-muted">{transaction.notes}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-sm text-text">
                          <span>{accountName}</span>
                          {transaction.type === 'transfer' && toAccountName && (
                            <span className="text-xs text-muted">→ {toAccountName}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-text">
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleOpenEdit(transaction.id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(transaction.id)}
                            disabled={isDeleting === transaction.id}
                          >
                            {isDeleting === transaction.id ? 'Menghapus...' : 'Hapus'}
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
        <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>{paginatedInfo}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
              disabled={currentPage === 0 || isLoading}
            >
              Sebelumnya
            </button>
            <span>
              Halaman {currentPage + 1} dari {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
              disabled={currentPage >= totalPages - 1 || isLoading}
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </section>

      <Modal open={Boolean(selectedTransactionId)} title="Edit Transaksi" onClose={handleCloseEdit}>
        {selectedTransactionId && (
          <EditTransactionForm
            transactionId={selectedTransactionId}
            onSaved={handleSaved}
            onCancel={handleCloseEdit}
          />
        )}
      </Modal>
    </div>
  );
}
