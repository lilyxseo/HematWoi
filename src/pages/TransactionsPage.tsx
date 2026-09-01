import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '../lib/format';
import { listAccounts, type AccountRecord } from '../lib/api';
import {
  deleteTransaction,
  listTransactions,
  type Tx,
} from '../services/transactions';
import useCategories from '../hooks/useCategories';
import useSupabaseUser from '../hooks/useSupabaseUser';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Modal from '../components/Modal';
import EditTransactionForm from '../components/EditTransactionForm';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Segmented from '../components/ui/Segmented';

type TypeFilter = 'all' | 'expense' | 'income' | 'transfer';

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
] as const;

const DATE_FORMATTER =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

const TYPE_LABEL: Record<Tx['type'], string> = {
  expense: 'Pengeluaran',
  income: 'Pemasukan',
  transfer: 'Transfer',
};

const AMOUNT_TONE: Record<Tx['type'], string> = {
  expense: 'text-rose-400',
  income: 'text-emerald-400',
  transfer: 'text-slate-300',
};

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toIso = (value: Date) => value.toISOString().slice(0, 10);
  return { start: toIso(start), end: toIso(end) };
}

const PAGE_SIZE = 20;

export default function TransactionsPage(): JSX.Element {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useSupabaseUser();
  const { data: categoriesData } = useCategories();

  const defaultRange = useMemo(() => getCurrentMonthRange(), []);

  const [dateFrom, setDateFrom] = useState<string>(defaultRange.start);
  const [dateTo, setDateTo] = useState<string>(defaultRange.end);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [accountFilter, setAccountFilter] = useState<string>('');
  const [searchDraft, setSearchDraft] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading || !user) {
      return;
    }

    let active = true;
    setAccountsLoading(true);
    listAccounts(user.id)
      .then((rows) => {
        if (!active) return;
        setAccounts(rows);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Gagal memuat daftar akun.';
        setActionError(message);
      })
      .finally(() => {
        if (active) {
          setAccountsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userLoading, user?.id]);

  useEffect(() => {
    if (userLoading || !user) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setErrorMessage(null);

    const params = {
      from: dateFrom || undefined,
      to: dateTo || undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
      accountId: accountFilter || undefined,
      search: searchTerm || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    } as const;

    listTransactions(params)
      .then((result) => {
        if (!active) return;
        setTransactions(result.rows);
        setTotal(result.total);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Gagal memuat transaksi.';
        setErrorMessage(message);
        setTransactions([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    userLoading,
    user?.id,
    dateFrom,
    dateTo,
    typeFilter,
    accountFilter,
    searchTerm,
    page,
    reloadKey,
  ]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, typeFilter, accountFilter, searchTerm]);

  const accountOptions = useMemo(() => {
    return [
      { value: '', label: 'Semua akun' },
      ...accounts.map((account) => ({ value: account.id, label: account.name })),
    ];
  }, [accounts]);

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((account) => {
      map.set(account.id, account.name);
    });
    return map;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categoriesData.forEach((category) => {
      map.set(category.id, category.name);
    });
    return map;
  }, [categoriesData]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = total === 0 ? 0 : Math.min(startItem + transactions.length - 1, total);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchDraft.trim());
  };

  const handleClearSearch = () => {
    setSearchDraft('');
    setSearchTerm('');
  };

  const handleDelete = async (id: string) => {
    if (!id || deletingId) {
      return;
    }
    const confirmed = window.confirm('Hapus transaksi ini?');
    if (!confirmed) {
      return;
    }
    setActionError(null);
    setDeletingId(id);
    try {
      await deleteTransaction(id);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Gagal menghapus transaksi.';
      setActionError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditOpen = (id: string) => {
    setEditingId(id);
    setEditOpen(true);
    setActionError(null);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setEditingId(null);
  };

  const handleEditSaved = () => {
    setEditOpen(false);
    setEditingId(null);
    setReloadKey((value) => value + 1);
  };

  const handleAddTransaction = () => {
    navigate('/transaction/add');
  };

  const renderRows = () => {
    if (isLoading) {
      return Array.from({ length: 5 }).map((_, index) => (
        <tr key={`skeleton-${index}`} className="animate-pulse">
          <td className="px-4 py-3">
            <div className="h-4 w-20 rounded bg-surface-alt" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 rounded bg-surface-alt" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 rounded bg-surface-alt" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-32 rounded bg-surface-alt" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 rounded bg-surface-alt" />
          </td>
          <td className="px-4 py-3">
            <div className="ml-auto h-4 w-24 rounded bg-surface-alt" />
          </td>
          <td className="px-4 py-3 text-right">
            <div className="inline-flex h-8 w-16 rounded bg-surface-alt" />
          </td>
        </tr>
      ));
    }

    if (!transactions.length) {
      return (
        <tr>
          <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">
            Tidak ada transaksi pada rentang dan filter ini.
          </td>
        </tr>
      );
    }

    return transactions.map((transaction) => {
      const categoryLabel =
        transaction.type === 'transfer'
          ? 'Transfer'
          : categoryMap.get(transaction.category_id ?? '') ?? 'Tanpa kategori';
      const accountLabel = accountMap.get(transaction.account_id ?? '') ?? '—';
      const toAccountLabel =
        transaction.type === 'transfer'
          ? accountMap.get(transaction.to_account_id ?? '') ?? '—'
          : null;
      const accountDisplay =
        transaction.type === 'transfer'
          ? `${accountLabel} → ${toAccountLabel}`
          : accountLabel;
      const formattedDate = transaction.date
        ? DATE_FORMATTER?.format(new Date(transaction.date)) ?? transaction.date
        : '—';
      const amountClass = AMOUNT_TONE[transaction.type];

      return (
        <tr key={transaction.id} className="border-b border-border-subtle/60 last:border-0">
          <td className="px-4 py-3 text-sm text-muted">{formattedDate}</td>
          <td className="px-4 py-3 text-sm font-medium text-text">{TYPE_LABEL[transaction.type]}</td>
          <td className="px-4 py-3 text-sm text-text">{categoryLabel}</td>
          <td className="px-4 py-3 text-sm text-text">
            {transaction.title?.trim() || '—'}
          </td>
          <td className="px-4 py-3 text-sm text-text">{accountDisplay}</td>
          <td className={`px-4 py-3 text-right text-sm font-semibold ${amountClass}`}>
            {formatCurrency(transaction.amount ?? 0, 'IDR')}
          </td>
          <td className="px-4 py-3 text-right text-sm">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-alt text-text transition hover:bg-surface"
                onClick={() => handleEditOpen(transaction.id)}
                aria-label="Edit transaksi"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-alt text-text transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => handleDelete(transaction.id)}
                disabled={deletingId === transaction.id}
                aria-label="Hapus transaksi"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <Page>
      <PageHeader title="Transaksi" description="Kelola transaksi Anda">
        <button type="button" className="btn btn-primary" onClick={handleAddTransaction}>
          Tambah Transaksi
        </button>
      </PageHeader>

      <div className="card space-y-5 p-6">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Dari tanggal"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <Input
            label="Sampai tanggal"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
          <div className="space-y-2">
            <label className="form-label">Tipe transaksi</label>
            <Segmented
              value={typeFilter}
              onChange={(value: string) => {
                if (value === 'all' || value === 'expense' || value === 'income' || value === 'transfer') {
                  setTypeFilter(value);
                }
              }}
              options={TYPE_FILTER_OPTIONS}
            />
          </div>
          <Select
            label="Akun"
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            options={accountOptions}
            disabled={accountsLoading}
          />
        </div>

        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleSearchSubmit}>
          <div className="flex-1">
            <Input
              label="Pencarian"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Cari judul atau catatan"
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="btn btn-primary">
              Terapkan
            </button>
            {searchTerm || searchDraft ? (
              <button type="button" className="btn btn-ghost" onClick={handleClearSearch}>
                Bersihkan
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {actionError ? (
        <div className="mt-6 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {actionError}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-3xl border border-border-subtle/60 bg-surface">
        {errorMessage ? (
          <div className="border-b border-border-subtle bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-subtle">
            <thead className="bg-surface-alt">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Tanggal
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Tipe
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Kategori
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Judul
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Akun
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                  Jumlah
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60">{renderRows()}</tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border-subtle bg-surface-alt px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div>
            Menampilkan {startItem === 0 ? 0 : `${startItem}-${endItem}`} dari {total} transaksi
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1 || isLoading}
            >
              Sebelumnya
            </button>
            <span className="text-xs font-semibold text-text">
              Halaman {page} dari {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages || isLoading}
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      <Modal open={editOpen} title="Edit Transaksi" onClose={handleEditClose}>
        <EditTransactionForm
          open={editOpen}
          transactionId={editingId}
          accounts={accounts}
          onCancel={handleEditClose}
          onSaved={handleEditSaved}
        />
      </Modal>
    </Page>
  );
}
