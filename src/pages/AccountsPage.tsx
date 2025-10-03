import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Section from '../layout/Section';
import Card, { CardBody, CardHeader } from '../components/Card';
import AccountFormModal, { type AccountFormValues } from '../components/accounts/AccountFormModal';
import { useToast } from '../context/ToastContext';
import {
  type AccountRecord,
  type AccountType,
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
} from '../lib/api.ts';
import useSupabaseUser from '../hooks/useSupabaseUser';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-Wallet',
  other: 'Lainnya',
};

const FILTER_OPTIONS: { value: 'all' | AccountType; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'cash', label: 'Tunai' },
  { value: 'bank', label: 'Bank' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'other', label: 'Lainnya' },
];

type SortOption = 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'Nama (A-Z)' },
  { value: 'name-desc', label: 'Nama (Z-A)' },
  { value: 'created-desc', label: 'Terbaru' },
  { value: 'created-asc', label: 'Terlama' },
];

function sortAccounts(list: AccountRecord[], sort: SortOption): AccountRecord[] {
  return [...list].sort((a, b) => {
    switch (sort) {
      case 'name-desc':
        return (b.name || '').localeCompare(a.name || '', 'id', { sensitivity: 'base' });
      case 'created-desc':
        return parseTimestamp(b.created_at) - parseTimestamp(a.created_at);
      case 'created-asc':
        return parseTimestamp(a.created_at) - parseTimestamp(b.created_at);
      case 'name-asc':
      default:
        return (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' });
    }
  });
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

export default function AccountsPage() {
  const { addToast } = useToast();
  const { user, loading: userLoading } = useSupabaseUser();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [filter, setFilter] = useState<'all' | AccountType>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    const uid = user?.id ?? null;
    if (!uid) {
      setAccounts([]);
      setLoading(false);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listAccounts(uid);
      setAccounts(rows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal memuat akun. Silakan coba lagi.';
      setLoadError(message);
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [user, addToast]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const sortedAccounts = useMemo(() => sortAccounts(accounts, sortOption), [accounts, sortOption]);

  const filteredAccounts = useMemo(() => {
    if (filter === 'all') return sortedAccounts;
    return sortedAccounts.filter((account) => account.type === filter);
  }, [sortedAccounts, filter]);

  const modalInitialValues = useMemo(() => {
    if (modalMode === 'edit' && selectedAccount) {
      return {
        name: selectedAccount.name ?? '',
        type: selectedAccount.type,
        currency: selectedAccount.currency ?? 'IDR',
      } satisfies AccountFormValues;
    }
    return undefined;
  }, [modalMode, selectedAccount]);

  const resetModalState = useCallback(() => {
    setModalOpen(false);
    setModalError(null);
    setSelectedAccount(null);
    setModalMode('create');
  }, []);

  const handleAddClick = useCallback(() => {
    setModalMode('create');
    setSelectedAccount(null);
    setModalError(null);
    setModalOpen(true);
  }, []);

  const handleEditClick = useCallback((account: AccountRecord) => {
    setModalMode('edit');
    setSelectedAccount(account);
    setModalError(null);
    setModalOpen(true);
  }, []);

  const handleSubmit = useCallback(
    async (values: AccountFormValues) => {
      setModalBusy(true);
      setModalError(null);
      try {
        if (modalMode === 'edit' && selectedAccount) {
          const updated = await updateAccount(selectedAccount.id, values);
          setAccounts((prev) => prev.map((acc) => (acc.id === updated.id ? updated : acc)));
          addToast('Akun diperbarui', 'success');
        } else {
          if (!user?.id) {
            throw new Error('Anda harus login untuk menambah akun.');
          }
          const created = await createAccount(user.id, values);
          setAccounts((prev) => [...prev, created]);
          addToast('Akun ditambahkan', 'success');
        }
        resetModalState();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Gagal menyimpan akun. Silakan coba lagi.';
        setModalError(message);
      } finally {
        setModalBusy(false);
      }
    },
    [addToast, modalMode, resetModalState, selectedAccount, user?.id],
  );

  const handleDelete = useCallback(
    async (account: AccountRecord) => {
      const confirmMessage = `Hapus akun "${account.name || 'Tanpa Nama'}"?`;
      const confirmed =
        typeof globalThis.confirm === 'function' ? globalThis.confirm(confirmMessage) : true;
      if (!confirmed) {
        return;
      }
      setDeletingId(account.id);
      try {
        await deleteAccount(account.id);
        setAccounts((prev) => prev.filter((item) => item.id !== account.id));
        addToast('Akun dihapus', 'success');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Gagal menghapus akun. Silakan coba lagi.';
        addToast(message, 'error');
      } finally {
        setDeletingId(null);
      }
    },
    [addToast],
  );

  const handleModalClose = useCallback(() => {
    if (!modalBusy) {
      resetModalState();
    }
  }, [modalBusy, resetModalState]);

  const canManage = Boolean(user?.id);

  return (
    <Page>
      <PageHeader
        title="Akun"
        description="Kelola daftar akun sumber transaksi Anda."
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAddClick}
          disabled={!canManage}
        >
          <Plus className="h-4 w-4" /> Tambah Akun
        </button>
      </PageHeader>
      <Section first>
        <Card>
          <CardHeader
            title="Daftar Akun"
            subtext="Tambah, ubah, atau hapus akun sesuai kebutuhan Anda."
          />
          {!userLoading && !canManage ? (
            <div className="mx-4 mb-4 rounded-lg border border-dashed border-border bg-surface-2/60 p-4 text-sm text-muted">
              Masuk ke akun HematWoi untuk menyinkronkan dan mengelola daftar akun keuangan Anda.
            </div>
          ) : null}
          <CardBody className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={clsx(
                      'rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                      filter === option.value
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border-subtle text-muted hover:text-text',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-3 text-xs font-semibold text-muted" htmlFor="account-sort">
                Urutkan
                <select
                  id="account-sort"
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value as SortOption)}
                  className="h-9 rounded-2xl border border-border-subtle bg-background px-3 text-xs font-medium text-text outline-none transition-colors focus:border-primary"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted">
                <Loader2 className="h-5 w-5 animate-spin" /> Memuat akun...
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-danger/20 bg-danger/5 p-5 text-sm text-danger">
                <p>{loadError}</p>
                <button
                  type="button"
                  className="mt-3 btn btn-secondary"
                  onClick={fetchAccounts}
                >
                  Coba lagi
                </button>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-alt/40 px-5 py-12 text-center text-sm text-muted">
                {accounts.length === 0
                  ? 'Belum ada akun. Tambah akun pertama Anda untuk mulai mencatat transaksi.'
                  : 'Tidak ada akun yang sesuai dengan filter ini.'}
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredAccounts.map((account) => (
                  <li
                    key={account.id}
                    className="rounded-3xl border border-border-subtle bg-surface-alt/60 p-5 shadow-sm transition-all hover:border-border-strong"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-text">
                          {account.name || 'Tanpa Nama'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                          <span className="badge-muted">{ACCOUNT_TYPE_LABELS[account.type]}</span>
                          <span className="rounded-full bg-surface px-3 py-1 font-medium text-text">
                            {account.currency || 'IDR'}
                          </span>
                          <span className="flex items-center gap-1">
                            Dibuat {formatDate(account.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleEditClick(account)}
                          disabled={modalBusy || deletingId === account.id}
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDelete(account)}
                          disabled={deletingId === account.id}
                        >
                          {deletingId === account.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Hapus
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </Section>
      <AccountFormModal
        open={modalOpen}
        mode={modalMode}
        busy={modalBusy}
        error={modalError}
        initialValues={modalInitialValues}
        onClose={handleModalClose}
        onSubmit={handleSubmit}
      />
    </Page>
  );
}
