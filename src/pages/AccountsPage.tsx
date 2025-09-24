import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Section from '../layout/Section';
import Card, { CardBody, CardHeader } from '../components/Card';
import AccountFormModal, { type AccountFormValues } from '../components/accounts/AccountFormModal';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase.js';
import {
  type AccountRecord,
  type AccountType,
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
} from '../lib/api.ts';

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

function sortAccounts(list: AccountRecord[]): AccountRecord[] {
  return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' }));
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

export default function AccountsPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [filter, setFilter] = useState<'all' | AccountType>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        throw error;
      }
      const uid = data.user?.id;
      if (!uid) {
        throw new Error('Anda harus login untuk melihat akun.');
      }
      setUserId(uid);
      const rows = await listAccounts(uid);
      setAccounts(sortAccounts(rows));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal memuat akun. Silakan coba lagi.';
      setLoadError(message);
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const filteredAccounts = useMemo(() => {
    if (filter === 'all') return accounts;
    return accounts.filter((account) => account.type === filter);
  }, [accounts, filter]);

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
          setAccounts((prev) => sortAccounts(prev.map((acc) => (acc.id === updated.id ? updated : acc))));
          addToast('Akun diperbarui', 'success');
        } else {
          if (!userId) {
            throw new Error('Anda harus login untuk menambah akun.');
          }
          const created = await createAccount(userId, values);
          setAccounts((prev) => sortAccounts([...prev, created]));
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
    [addToast, modalMode, resetModalState, selectedAccount, userId],
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

  return (
    <Page>
      <PageHeader
        title="Akun"
        description="Kelola daftar akun sumber transaksi Anda."
      >
        <button type="button" className="btn btn-primary" onClick={handleAddClick}>
          <Plus className="h-4 w-4" /> Tambah Akun
        </button>
      </PageHeader>
      <Section first>
        <Card>
          <CardHeader
            title="Daftar Akun"
            subtext="Tambah, ubah, atau hapus akun sesuai kebutuhan Anda."
          />
          <CardBody className="space-y-5">
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
