import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import SummaryCards from '../components/debts/SummaryCards';
import FilterBar, { DebtsFilterState } from '../components/debts/FilterBar';
import DebtsTableResponsive from '../components/debts/DebtsTableResponsive';
import DebtForm from '../components/debts/DebtForm';
import PaymentDrawer from '../components/debts/PaymentDrawer';
import ConfirmDialog from '../components/debts/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useDataMode } from '../context/DataContext';
import {
  addPayment,
  createDebt,
  deleteDebt,
  deletePayment,
  getDebt,
  listDebts,
  mapPaymentRow,
  updateDebt,
  PAYMENT_SELECT_COLUMNS,
  type DebtInput,
  type DebtPaymentRecord,
  type DebtRecord,
  type DebtSummary,
  type PaymentTransactionSummary,
} from '../lib/api-debts';
import {
  listAccounts as fetchAccounts,
  type AccountRecord,
} from '../lib/api.ts';
import {
  listDrafts,
  listDraftsByDebt,
  removeDraft,
  saveDraft,
} from '../lib/debt-payment-drafts';
import { supabase } from '../lib/supabase';
import useSupabaseUser from '../hooks/useSupabaseUser';

const INITIAL_FILTERS: DebtsFilterState = {
  q: '',
  type: 'all',
  status: 'all',
  dateField: 'created_at',
  dateFrom: null,
  dateTo: null,
  sort: 'newest',
};

function toISO(date: string | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function computeStatus(amount: number, paid: number, dueDate: string | null) {
  if (paid + 0.0001 >= amount) return 'paid' as const;
  if (dueDate) {
    const due = new Date(dueDate);
    if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now()) {
      return 'overdue';
    }
  }
  return 'ongoing' as const;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

export default function Debts() {
  const { addToast } = useToast();
  const { mode } = useDataMode();
  const { user, loading: userLoading } = useSupabaseUser();
  const isOnlineMode = mode === 'online';
  const canUseCloud = isOnlineMode && Boolean(user?.id);
  const offlineDraftMode =
    !isOnlineMode ||
    !user?.id ||
    (typeof navigator !== 'undefined' && !navigator.onLine);
  const [filters, setFilters] = useState<DebtsFilterState>(INITIAL_FILTERS);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [summary, setSummary] = useState<DebtSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<DebtRecord | null>(null);
  const [serverPayments, setServerPayments] = useState<DebtPaymentRecord[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentDeletingId, setPaymentDeletingId] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<DebtRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [pendingPaymentDelete, setPendingPaymentDelete] = useState<DebtPaymentRecord | null>(null);
  const [recentPayment, setRecentPayment] = useState<DebtPaymentRecord | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [syncingDrafts, setSyncingDrafts] = useState(false);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const logError = useCallback((error: unknown, context: string) => {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error(`[HW][Debts] ${context}`, error);
    }
  }, []);

  const triggerTransactionsRefresh = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('hw:transactions:refresh-request', {
        detail: { scope: 'current-month', source: 'debt-payment' },
      }),
    );
  }, []);

  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((account) => {
      map.set(account.id, account.name ?? '');
    });
    return map;
  }, [accounts]);

  const paymentList = useMemo(() => {
    if (!paymentDebt) return [];
    const drafts = listDraftsByDebt(paymentDebt.id);
    const draftRecords: DebtPaymentRecord[] = drafts.map((draft) => ({
      id: draft.id,
      debt_id: draft.debt_id,
      user_id: draft.user_id ?? user?.id ?? 'offline',
      amount: draft.amount,
      paid_at: draft.paid_at,
      account_id: draft.account_id,
      account_name: accountNameMap.get(draft.account_id) ?? null,
      note: draft.note,
      created_at: draft.created_at,
      related_tx_id: null,
      transaction: null,
      sync_status: 'queued',
      isDraft: true,
    }));
    return [...draftRecords, ...serverPayments];
  }, [paymentDebt, serverPayments, accountNameMap, user?.id, draftVersion]);

  useEffect(() => {
    let active = true;
    if (!canUseCloud) {
      setDebts([]);
      setSummary(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    (async () => {
      try {
        const result = await listDebts(filters);
        if (!active) return;
        setDebts(result.items);
        setSummary(result.summary);
      } catch (error) {
        logError(error, 'fetch debts');
        addToast('Gagal memuat daftar hutang', 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [filters, addToast, logError, canUseCloud]);

  useEffect(() => {
    let ignore = false;
    if (!isOnlineMode || !user?.id) {
      setAccounts([]);
      return () => {
        ignore = true;
      };
    }
    setAccountsLoading(true);
    fetchAccounts(user.id)
      .then((rows) => {
        if (!ignore) {
          setAccounts(rows);
        }
      })
      .catch((error) => {
        logError(error, 'load accounts');
      })
      .finally(() => {
        if (!ignore) {
          setAccountsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [isOnlineMode, user?.id, logError]);

  const refreshData = useCallback(async () => {
    if (!canUseCloud) {
      setDebts([]);
      setSummary(null);
      return;
    }
    try {
      const result = await listDebts(filters);
      setDebts(result.items);
      setSummary(result.summary);
    } catch (error) {
      logError(error, 'refresh debts');
    }
  }, [filters, logError, canUseCloud]);

  const handleCreateClick = () => {
    if (!canUseCloud) {
      addToast('Masuk untuk menambah hutang atau piutang.', 'error');
      return;
    }
    setFormMode('create');
    setEditingDebt(null);
    setFormOpen(true);
  };

  const handleEditClick = (debt: DebtRecord) => {
    if (!canUseCloud) {
      addToast('Masuk untuk mengubah data hutang.', 'error');
      return;
    }
    setEditingDebt(debt);
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload: DebtInput) => {
    if (!canUseCloud) {
      addToast('Mode offline tidak mendukung penyimpanan hutang.', 'error');
      return;
    }
    setFormSubmitting(true);
    if (formMode === 'create') {
      const tempId = `temp-${Date.now()}`;
      const optimistic: DebtRecord = {
        id: tempId,
        user_id: 'temp',
        type: payload.type,
        party_name: payload.party_name,
        title: payload.title,
        date: toISO(payload.date) ?? new Date().toISOString(),
        due_date: toISO(payload.due_date ?? null),
        amount: payload.amount,
        rate_percent: payload.rate_percent ?? 0,
        paid_total: 0,
        remaining: payload.amount,
        status: computeStatus(payload.amount, 0, toISO(payload.due_date ?? null)),
        notes: payload.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setDebts((prev) => [optimistic, ...prev]);
      try {
        const created = await createDebt(payload);
        setDebts((prev) => prev.map((item) => (item.id === tempId ? created : item)));
        addToast('Hutang berhasil ditambahkan', 'success');
        await refreshData();
        setFormOpen(false);
      } catch (error) {
        logError(error, 'create debt');
        setDebts((prev) => prev.filter((item) => item.id !== tempId));
        addToast('Gagal menambahkan hutang', 'error');
      } finally {
        setFormSubmitting(false);
      }
      return;
    }

    if (!editingDebt) return;
    const previous = debts;
    const optimistic = previous.map((item) =>
      item.id === editingDebt.id
        ? {
            ...item,
            type: payload.type,
            party_name: payload.party_name,
            title: payload.title,
            date: toISO(payload.date) ?? item.date,
            due_date: toISO(payload.due_date ?? null),
            amount: payload.amount,
            rate_percent: payload.rate_percent ?? item.rate_percent ?? 0,
            notes: payload.notes ?? null,
            remaining: Math.max(payload.amount - item.paid_total, 0),
            status: computeStatus(payload.amount, item.paid_total, toISO(payload.due_date ?? null)),
          }
        : item,
    );
    setDebts(optimistic);
    try {
      const updated = await updateDebt(editingDebt.id, payload);
      setDebts((prev) => prev.map((item) => (item.id === editingDebt.id ? updated : item)));
      addToast('Hutang berhasil diperbarui', 'success');
      await refreshData();
      setFormOpen(false);
    } catch (error) {
      logError(error, 'update debt');
      setDebts(previous);
      addToast('Gagal memperbarui hutang', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteRequest = (debt: DebtRecord) => {
    setPendingDelete(debt);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    if (!canUseCloud) {
      addToast('Masuk untuk menghapus hutang.', 'error');
      setPendingDelete(null);
      return;
    }
    const target = pendingDelete;
    setDeleteLoading(true);
    const previous = debts;
    setDebts((prev) => prev.filter((item) => item.id !== target.id));
    try {
      await deleteDebt(target.id);
      addToast('Hutang berhasil dihapus', 'success');
      await refreshData();
    } catch (error) {
      logError(error, 'delete debt');
      addToast('Gagal menghapus hutang', 'error');
      setDebts(previous);
    } finally {
      setDeleteLoading(false);
      setPendingDelete(null);
    }
  };

  const handleExport = async () => {
    if (!canUseCloud) {
      addToast('Masuk untuk mengekspor daftar hutang.', 'error');
      return;
    }
    try {
      setExporting(true);
      if (!debts.length) {
        addToast('Tidak ada data untuk diekspor', 'info');
        return;
      }
      const headers = [
        'Tipe',
        'Pihak',
        'Judul',
        'Tanggal',
        'Jatuh Tempo',
        'Jumlah',
        'Terbayar',
        'Sisa',
        'Status',
        'Catatan',
      ];
      const rows = debts.map((item) => [
        item.type === 'debt' ? 'Hutang' : 'Piutang',
        item.party_name,
        item.title,
        item.date ? new Date(item.date).toLocaleDateString('id-ID') : '',
        item.due_date ? new Date(item.due_date).toLocaleDateString('id-ID') : '',
        formatCurrency(item.amount),
        formatCurrency(item.paid_total),
        formatCurrency(item.remaining),
        item.status,
        item.notes ?? '',
      ]);
      const encode = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => encode(String(cell ?? ''))).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      link.download = `hutang-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('Daftar hutang berhasil diekspor', 'success');
    } catch (error) {
      logError(error, 'export csv');
      addToast('Gagal mengekspor CSV', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenPayment = async (debt: DebtRecord) => {
    if (isOnlineMode && !user?.id) {
      addToast('Masuk untuk mengelola pembayaran hutang.', 'error');
      return;
    }
    setRecentPayment(null);
    setPaymentDebt(debt);
    setPaymentOpen(true);
    if (!isOnlineMode || !user?.id) {
      setServerPayments([]);
      setPaymentLoading(false);
      return;
    }
    setPaymentLoading(true);
    try {
      const detail = await getDebt(debt.id);
      if (detail.debt) {
        setPaymentDebt(detail.debt);
        setDebts((prev) => prev.map((item) => (item.id === detail.debt!.id ? detail.debt! : item)));
      }
      setServerPayments(detail.payments);
    } catch (error) {
      logError(error, 'load payments');
      addToast('Gagal memuat pembayaran', 'error');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePaymentSubmit = async (input: {
    amount: number;
    paid_at: string;
    account_id: string;
    note?: string | null;
  }) => {
    if (!paymentDebt) return;
    const amount = Math.max(0, input.amount);
    const offlineMode = !isOnlineMode || !user?.id || !navigator.onLine;
    if (offlineMode) {
      const draftId = `draft-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
      saveDraft({
        id: draftId,
        debt_id: paymentDebt.id,
        user_id: user?.id ?? null,
        amount,
        paid_at: input.paid_at,
        account_id: input.account_id,
        note: input.note ?? null,
        created_at: new Date().toISOString(),
      });
      setDraftVersion((prev) => prev + 1);
      const optimisticDebt: DebtRecord = {
        ...paymentDebt,
        paid_total: paymentDebt.paid_total + amount,
        remaining: Math.max(paymentDebt.remaining - amount, 0),
        status: computeStatus(paymentDebt.amount, paymentDebt.paid_total + amount, paymentDebt.due_date),
      };
      setPaymentDebt(optimisticDebt);
      setDebts((prev) => prev.map((item) => (item.id === optimisticDebt.id ? optimisticDebt : item)));
      addToast('Pembayaran disimpan sebagai draft. Akan tersinkron saat online.', 'success');
      return;
    }

    setPaymentSubmitting(true);
    const tempId = `temp-payment-${Date.now()}`;
    const optimisticPayment: DebtPaymentRecord = {
      id: tempId,
      debt_id: paymentDebt.id,
      user_id: paymentDebt.user_id,
      amount,
      paid_at: input.paid_at,
      account_id: input.account_id,
      account_name: accountNameMap.get(input.account_id) ?? null,
      note: input.note ?? null,
      created_at: new Date().toISOString(),
      related_tx_id: null,
      transaction: null,
    };
    setServerPayments((prev) => [optimisticPayment, ...prev]);
    const previousDebt = paymentDebt;
    const updatedDebt: DebtRecord = {
      ...paymentDebt,
      paid_total: paymentDebt.paid_total + amount,
      remaining: Math.max(paymentDebt.remaining - amount, 0),
      status: computeStatus(paymentDebt.amount, paymentDebt.paid_total + amount, paymentDebt.due_date),
    };
    setPaymentDebt(updatedDebt);
    setDebts((prev) => prev.map((item) => (item.id === updatedDebt.id ? updatedDebt : item)));
    try {
      const result = await addPayment(paymentDebt.id, input);
      if (result.debt) {
        setPaymentDebt(result.debt);
        setDebts((prev) => prev.map((item) => (item.id === result.debt!.id ? result.debt! : item)));
      }
      setServerPayments((prev) => [result.payment, ...prev.filter((payment) => payment.id !== tempId)]);
      setRecentPayment(result.payment);
      addToast('Pembayaran tercatat & saldo keluar dibuat otomatis.', 'success');
      await refreshData();
      triggerTransactionsRefresh();
    } catch (error) {
      logError(error, 'add payment');
      setServerPayments((prev) => prev.filter((payment) => payment.id !== tempId));
      setPaymentDebt(previousDebt);
      setDebts((prev) => prev.map((item) => (item.id === previousDebt.id ? previousDebt : item)));
      addToast('Gagal mencatat pembayaran', 'error');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const syncDraftPayments = useCallback(async () => {
    if (!isOnlineMode || !user?.id || !navigator.onLine) return;
    const drafts = listDrafts();
    if (!drafts.length) return;
    if (syncingDrafts) return;
    setSyncingDrafts(true);
    const succeeded: DebtPaymentRecord[] = [];
    const failed: string[] = [];
    for (const draft of drafts) {
      try {
        const { data, error } = await supabase
          .from('debt_payments')
          .insert([
            {
              debt_id: draft.debt_id,
              user_id: user.id,
              amount: Number(draft.amount.toFixed(2)),
              paid_at: draft.paid_at,
              account_id: draft.account_id,
              note: draft.note,
            },
          ])
          .select(PAYMENT_SELECT_COLUMNS)
          .single();
        if (error) throw error;
        if (data) {
          removeDraft(draft.id);
          succeeded.push(mapPaymentRow(data));
        }
      } catch (error) {
        logError(error, 'sync draft payment');
        failed.push(draft.id);
      }
    }

    if (succeeded.length) {
      setDraftVersion((prev) => prev + 1);
      await refreshData();
      triggerTransactionsRefresh();
      if (paymentDebt) {
        try {
          const detail = await getDebt(paymentDebt.id);
          if (detail.debt) {
            setPaymentDebt(detail.debt);
            setDebts((prev) => prev.map((item) => (item.id === detail.debt!.id ? detail.debt! : item)));
          }
          setServerPayments(detail.payments);
          const newestPayment = detail.payments?.[0] ?? succeeded[succeeded.length - 1] ?? null;
          if (newestPayment) {
            setRecentPayment(newestPayment);
          }
        } catch (error) {
          logError(error, 'reload payments after sync');
          const fallback = succeeded[succeeded.length - 1] ?? null;
          if (fallback) {
            setRecentPayment(fallback);
          }
        }
      } else {
        const fallback = succeeded[succeeded.length - 1] ?? null;
        if (fallback) {
          setRecentPayment(fallback);
        }
      }
      addToast('Draft pembayaran tersinkron otomatis.', 'success');
    }

    if (failed.length) {
      addToast('Sebagian draft pembayaran belum tersinkron.', 'warning');
    }

    setSyncingDrafts(false);
  }, [
    isOnlineMode,
    user?.id,
    syncingDrafts,
    refreshData,
    triggerTransactionsRefresh,
    paymentDebt,
    logError,
    setDebts,
  ]);

  useEffect(() => {
    if (!isOnlineMode || !user?.id) return;
    if (!navigator.onLine) return;
    syncDraftPayments();
    const handleOnline = () => {
      syncDraftPayments();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isOnlineMode, user?.id, syncDraftPayments]);

  const handleDeletePayment = (payment: DebtPaymentRecord) => {
    setPendingPaymentDelete(payment);
  };

  const confirmDeletePayment = async () => {
    if (!pendingPaymentDelete || !paymentDebt) return;
    const payment = pendingPaymentDelete;
    if (payment.isDraft) {
      removeDraft(payment.id);
      setDraftVersion((prev) => prev + 1);
      addToast('Draft pembayaran dihapus.', 'success');
      setPendingPaymentDelete(null);
      return;
    }
    if (!isOnlineMode || !user?.id) {
      addToast('Masuk untuk menghapus pembayaran hutang.', 'error');
      setPendingPaymentDelete(null);
      return;
    }
    setPaymentDeletingId(payment.id);
    setServerPayments((prev) => prev.filter((item) => item.id !== payment.id));
    const backupDebt = paymentDebt;
    try {
      const updated = await deletePayment(payment.id);
      if (updated) {
        setPaymentDebt(updated);
        setDebts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      addToast('Pembayaran dihapus', 'success');
      await refreshData();
      triggerTransactionsRefresh();
    } catch (error) {
      logError(error, 'delete payment');
      setServerPayments((prev) => [payment, ...prev]);
      setPaymentDebt(backupDebt);
      setDebts((prev) => prev.map((item) => (item.id === backupDebt.id ? backupDebt : item)));
      addToast('Gagal menghapus pembayaran', 'error');
    } finally {
      setPaymentDeletingId(null);
      setPendingPaymentDelete(null);
    }
  };

  const handleClosePayment = () => {
    setPaymentOpen(false);
    setPaymentDebt(null);
    setServerPayments([]);
    setRecentPayment(null);
    setPendingPaymentDelete(null);
    setPaymentDeletingId(null);
  };

  const pageDescription = useMemo(
    () => 'Kelola hutang dan piutang dengan pencatatan pembayaran terkontrol.',
    [],
  );

  const disableActions = !canUseCloud;

  return (
    <Page>
      <div className="space-y-6 min-w-0">
        <PageHeader title="Hutang" description={pageDescription}>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || disableActions}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface-1 px-4 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting ? 'Mengekspor…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={handleCreateClick}
            disabled={disableActions}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah Hutang/Piutang
          </button>
        </PageHeader>

        {!userLoading && !canUseCloud ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface-2/70 px-4 py-3 text-sm text-muted">
            Mode offline aktif. Masuk untuk melihat dan mengelola data hutang yang tersimpan di cloud.
          </div>
        ) : null}

        <SummaryCards summary={summary} />

        <FilterBar
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(INITIAL_FILTERS)}
        />

        <section className="min-w-0">
          <DebtsTableResponsive
            debts={debts}
            loading={loading}
            onEdit={handleEditClick}
            onDelete={handleDeleteRequest}
            onAddPayment={handleOpenPayment}
          />
        </section>
      </div>

      <DebtForm
        open={formOpen}
        mode={formMode}
        initialData={editingDebt}
        submitting={formSubmitting}
        onSubmit={handleFormSubmit}
        onClose={() => {
          if (!formSubmitting) {
            setFormOpen(false);
            setEditingDebt(null);
          }
        }}
      />

      <PaymentDrawer
        open={paymentOpen}
        debt={paymentDebt}
        payments={paymentList}
        accounts={accounts}
        accountsLoading={accountsLoading}
        loading={paymentLoading}
        submitting={paymentSubmitting}
        deletingId={paymentDeletingId}
        draftMode={offlineDraftMode}
        recentPayment={recentPayment}
        syncingDrafts={syncingDrafts}
        onClose={handleClosePayment}
        onSubmit={handlePaymentSubmit}
        onDeletePayment={handleDeletePayment}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus hutang?"
        description="Tindakan ini juga akan menghapus seluruh riwayat pembayaran terkait."
        destructive
        loading={deleteLoading}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleteLoading) setPendingDelete(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingPaymentDelete)}
        title="Hapus pembayaran?"
        description="Pembayaran akan dihapus dari riwayat dan perhitungan total akan diperbarui."
        destructive
        loading={Boolean(paymentDeletingId)}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={confirmDeletePayment}
        onCancel={() => {
          if (!paymentDeletingId) setPendingPaymentDelete(null);
        }}
      />
    </Page>
  );
}
