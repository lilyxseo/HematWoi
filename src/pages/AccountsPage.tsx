import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
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
  reorderAccounts,
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

function orderAccounts(list: AccountRecord[]): AccountRecord[] {
  return [...list].sort((a, b) => {
    const orderDiff = (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER);
    if (orderDiff !== 0) {
      return orderDiff;
    }
    const createdDiff = Date.parse(a.created_at ?? '') - Date.parse(b.created_at ?? '');
    if (Number.isFinite(createdDiff) && createdDiff !== 0) {
      return createdDiff;
    }
    return (a.name || '').localeCompare(b.name || '', 'id', { sensitivity: 'base' });
  });
}

function resequenceAccounts(list: AccountRecord[]): AccountRecord[] {
  return list.map((account, index) => ({ ...account, sort_order: index }));
}

function moveItem<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return [...list];
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reorderPendingIds, setReorderPendingIds] = useState<Set<string>>(new Set());

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
      setAccounts(orderAccounts(rows));
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

  const orderedAccounts = useMemo(() => orderAccounts(accounts), [accounts]);

  const filteredAccounts = useMemo(() => {
    if (filter === 'all') return orderedAccounts;
    return orderedAccounts.filter((account) => account.type === filter);
  }, [filter, orderedAccounts]);

  const orderIndexMap = useMemo(() => {
    return new Map(orderedAccounts.map((account, index) => [account.id, index]));
  }, [orderedAccounts]);

  const addReorderPending = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setReorderPendingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const removeReorderPending = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setReorderPendingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const handleReorder = useCallback(
    (accountId: string, direction: 'up' | 'down') => {
      if (!user?.id) {
        addToast('Masuk untuk mengatur urutan akun.', 'error');
        return;
      }
      if (loading) return;

      const snapshot = accounts.slice();
      const ordered = orderAccounts(snapshot);
      const currentIndex = ordered.findIndex((item) => item.id === accountId);
      if (currentIndex < 0) {
        return;
      }
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= ordered.length) {
        return;
      }

      const moved = moveItem(ordered, currentIndex, targetIndex);
      const resequenced = resequenceAccounts(moved);
      const affectedIds = Array.from(new Set([ordered[currentIndex].id, ordered[targetIndex].id]))
        .filter(Boolean);

      setAccounts(resequenced);
      addReorderPending(affectedIds);

      void reorderAccounts(user.id, resequenced.map((item) => item.id)).catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal mengubah urutan akun. Silakan coba lagi.';
        setAccounts(snapshot);
        addToast(message, 'error');
      }).finally(() => {
        removeReorderPending(affectedIds);
      });
    },
    [accounts, addReorderPending, addToast, loading, removeReorderPending, user?.id],
  );

  const handleMoveUp = useCallback(
    (accountId: string) => {
      handleReorder(accountId, 'up');
    },
    [handleReorder],
  );

  const handleMoveDown = useCallback(
    (accountId: string) => {
      handleReorder(accountId, 'down');
    },
    [handleReorder],
  );

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
          setAccounts((prev) =>
            orderAccounts(prev.map((acc) => (acc.id === updated.id ? updated : acc))),
          );
          addToast('Akun diperbarui', 'success');
        } else {
          if (!user?.id) {
            throw new Error('Anda harus login untuk menambah akun.');
          }
          const created = await createAccount(user.id, values);
          setAccounts((prev) => orderAccounts([...prev, created]));
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
  const totalAccounts = orderedAccounts.length;
  const canReorder = canManage && filter === 'all';

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
            subtext="Tambah, atur prioritas, ubah, atau hapus akun sesuai kebutuhan Anda."
          />
          {!userLoading && !canManage ? (
            <div className="mx-4 mb-4 rounded-lg border border-dashed border-border bg-surface-2/60 p-4 text-sm text-muted">
              Masuk ke akun HematWoi untuk menyinkronkan dan mengelola daftar akun keuangan Anda.
            </div>
          ) : null}
          <CardBody className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
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
                {filteredAccounts.map((account) => {
                  const orderIndex = orderIndexMap.get(account.id) ?? 0;
                  const isFirst = orderIndex === 0;
                  const isLast = orderIndex === totalAccounts - 1;
                  const isReordering = reorderPendingIds.has(account.id);
                  const disableMoveUp =
                    !canReorder || isFirst || totalAccounts < 2 || isReordering || Boolean(deletingId);
                  const disableMoveDown =
                    !canReorder || isLast || totalAccounts < 2 || isReordering || Boolean(deletingId);
                  return (
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
                        <div className="flex flex-wrap items-center gap-2">
                          {canReorder && totalAccounts > 1 ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveUp(account.id)}
                                disabled={disableMoveUp}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-transparent text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label="Naikkan urutan akun"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDown(account.id)}
                                disabled={disableMoveDown}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-transparent text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label="Turunkan urutan akun"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                            </div>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleEditClick(account)}
                            disabled={modalBusy || deletingId === account.id || isReordering}
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleDelete(account)}
                            disabled={deletingId === account.id || isReordering}
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
                  );
                })}
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
