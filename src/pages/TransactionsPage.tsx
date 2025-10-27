import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Section from '../layout/Section';
import Card, { CardBody } from '../components/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Segmented from '../components/ui/Segmented';
import Modal from '../components/Modal';
import EditTransactionForm from '../components/EditTransactionForm';
import {
  deleteTransaction,
  listTransactions,
  type ListTransactionsParams,
  type Tx,
} from '../services/transactions';
import { fetchCategoriesByIds, type Category } from '../services/categories';
import { fetchAccounts, type Account } from '../services/accounts';

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
] as const;

type FilterType = (typeof TYPE_FILTER_OPTIONS)[number]['value'];

type Filters = {
  startDate: string;
  endDate: string;
  type: FilterType;
  accountId: string;
  search: string;
};

const DEFAULT_PAGE_SIZE = 20;

const TYPE_LABELS: Record<Tx['type'], string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
};

const AMOUNT_CLASS: Record<Tx['type'], string> = {
  expense: 'text-red-300',
  income: 'text-emerald-300',
  transfer: 'text-slate-200',
};

function getMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: formatDateInput(start), end: formatDateInput(end) };
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });
const amountFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 2,
});

export default function TransactionsPage(): JSX.Element {
  const navigate = useNavigate();
  const defaultRange = getMonthRange();
  const [filters, setFilters] = useState<Filters>({
    startDate: defaultRange.start,
    endDate: defaultRange.end,
    type: 'all',
    accountId: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [categoryMap, setCategoryMap] = useState<Record<string, Category>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const limit = DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * limit;

  const triggerReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleFiltersChange = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  useEffect(() => {
    let active = true;
    const loadAccounts = async () => {
      const rows = await fetchAccounts();
      if (!active) return;
      setAccounts(rows);
    };
    void loadAccounts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadTransactions = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: ListTransactionsParams = {
          startDate: filters.startDate,
          endDate: filters.endDate,
          type: filters.type,
          accountId: filters.accountId || undefined,
          search: filters.search || undefined,
          limit,
          offset,
        };
        const { rows, total: totalRows } = await listTransactions(params);
        if (cancelled) {
          return;
        }
        setTransactions(rows);
        setTotal(totalRows);
        if (!rows.length) {
          setCategoryMap({});
          return;
        }
        const categoryIds = Array.from(
          new Set(
            rows
              .map((row) => row.category_id)
              .filter((value): value is string => Boolean(value)),
          ),
        );
        if (!categoryIds.length) {
          setCategoryMap({});
          return;
        }
        const categories = await fetchCategoriesByIds(categoryIds);
        if (cancelled) {
          return;
        }
        const map: Record<string, Category> = {};
        categories.forEach((cat) => {
          map[cat.id] = cat;
        });
        setCategoryMap(map);
      } catch (err) {
        console.error('[transactions:list] Failed to load transactions page', err);
        if (!cancelled) {
          const resolved = err instanceof Error ? err : new Error('Gagal memuat transaksi.');
          setError(resolved);
          setTransactions([]);
          setTotal(0);
          setCategoryMap({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [filters.startDate, filters.endDate, filters.type, filters.accountId, filters.search, limit, offset, reloadKey]);

  const accountOptions = useMemo(
    () => [{ value: '', label: 'Semua akun' }, ...accounts.map((item) => ({ value: item.id, label: item.name }))],
    [accounts],
  );

  const accountNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    accounts.forEach((item) => {
      map[item.id] = item.name;
    });
    return map;
  }, [accounts]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = total === 0 ? 0 : Math.min(total, startIndex + transactions.length - 1);

  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm('Hapus transaksi ini?');
    if (!confirmDelete) return;
    setDeletingId(id);
    try {
      await deleteTransaction(id);
      triggerReload();
    } catch (err) {
      console.error('[transactions:update] Failed to delete transaction', err);
      setError(err instanceof Error ? err : new Error('Gagal menghapus transaksi.'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSaved = () => {
    setEditingId(null);
    triggerReload();
  };

  const handleRetry = () => {
    triggerReload();
  };

  const categoryLabel = (tx: Tx): string => {
    if (tx.type === 'transfer') {
      return 'Transfer';
    }
    if (!tx.category_id) {
      return 'Tanpa kategori';
    }
    const category = categoryMap[tx.category_id];
    return category ? category.name : 'Kategori hilang';
  };

  const renderTableBody = () => {
    if (loading && transactions.length === 0) {
      return (
        <tbody>
          {Array.from({ length: 5 }).map((_, index) => (
            <tr key={index} className="animate-pulse border-b border-slate-800/70">
              <td className="px-4 py-3">
                <div className="h-4 w-28 rounded bg-slate-800" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-20 rounded bg-slate-800" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-32 rounded bg-slate-800" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-48 rounded bg-slate-800" />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="ml-auto h-4 w-24 rounded bg-slate-800" />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="ml-auto h-4 w-16 rounded bg-slate-800" />
              </td>
            </tr>
          ))}
        </tbody>
      );
    }

    if (!transactions.length) {
      return (
        <tbody>
          <tr>
            <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
              Tidak ada transaksi untuk filter ini. Coba ubah rentang tanggal atau kata kunci.
            </td>
          </tr>
        </tbody>
      );
    }

    return (
      <tbody className="divide-y divide-slate-800/70">
        {transactions.map((tx) => (
          <tr key={tx.id} className="transition hover:bg-slate-900/40">
            <td className="px-4 py-3 text-sm text-slate-200">{dateFormatter.format(new Date(tx.date))}</td>
            <td className="px-4 py-3 text-sm font-medium text-slate-100">{TYPE_LABELS[tx.type]}</td>
            <td className="px-4 py-3 text-sm text-slate-200">{categoryLabel(tx)}</td>
            <td className="px-4 py-3 text-sm text-slate-300">
              {tx.title?.trim() || tx.notes?.trim() || '(Tanpa judul)'}
            </td>
            <td className="px-4 py-3 text-sm text-slate-300">
              {tx.type === 'transfer'
                ? `${accountNameMap[tx.account_id ?? ''] ?? '–'} → ${accountNameMap[tx.to_account_id ?? ''] ?? '–'}`
                : accountNameMap[tx.account_id ?? ''] ?? '–'}
            </td>
            <td className={`px-4 py-3 text-right text-sm font-semibold ${AMOUNT_CLASS[tx.type]}`}>
              {amountFormatter.format(tx.amount)}
            </td>
            <td className="px-4 py-3 text-right text-sm">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingId(tx.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-red-300 hover:text-red-200"
                  onClick={() => handleDelete(tx.id)}
                  disabled={deletingId === tx.id}
                >
                  {deletingId === tx.id ? 'Menghapus…' : 'Hapus'}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <Page>
      <PageHeader
        title="Transaksi"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate('/transaction/add')}>
            Tambah Transaksi
          </button>
        }
      />

      <Section first>
        <Card>
          <CardBody>
            <div className="grid gap-4 md:grid-cols-5">
              <Input
                type="date"
                label="Dari"
                value={filters.startDate}
                onChange={(event) => handleFiltersChange({ startDate: event.target.value })}
              />
              <Input
                type="date"
                label="Sampai"
                value={filters.endDate}
                onChange={(event) => handleFiltersChange({ endDate: event.target.value })}
              />
              <div className="space-y-1.5">
                <p className="form-label">Tipe</p>
                <Segmented
                  value={filters.type}
                  onChange={(value: string) => handleFiltersChange({ type: value as FilterType })}
                  options={TYPE_FILTER_OPTIONS}
                />
              </div>
              <Select
                label="Akun"
                value={filters.accountId}
                onChange={(event) => handleFiltersChange({ accountId: event.target.value })}
                options={accountOptions}
                placeholder="Pilih akun"
              />
              <Input
                label="Pencarian"
                value={filters.search}
                onChange={(event) => handleFiltersChange({ search: event.target.value })}
                placeholder="Judul, merchant, catatan"
              />
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section>
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error.message}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleRetry}>
                Coba lagi
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl bg-slate-950/60 ring-1 ring-slate-800">
          <table className="min-w-full divide-y divide-slate-800/80">
            <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Tanggal</th>
                <th className="px-4 py-3 font-semibold">Tipe</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 font-semibold">Judul</th>
                <th className="px-4 py-3 font-semibold">Akun</th>
                <th className="px-4 py-3 text-right font-semibold">Jumlah</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            {renderTableBody()}
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>
            {total === 0
              ? 'Tidak ada data'
              : `Menampilkan ${startIndex}–${endIndex} dari ${total} transaksi`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1 || loading}
            >
              Sebelumnya
            </button>
            <span>
              Halaman {page} dari {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </Section>

      <Modal open={Boolean(editingId)} title="Edit Transaksi" onClose={() => setEditingId(null)}>
        {editingId ? (
          <EditTransactionForm
            transactionId={editingId}
            onCancel={() => setEditingId(null)}
            onSaved={handleEditSaved}
          />
        ) : null}
      </Modal>
    </Page>
  );
}
