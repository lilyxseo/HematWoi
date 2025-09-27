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
import {
  addPayment,
  createDebt,
  deleteDebt,
  deletePayment,
  getDebt,
  listDebts,
  updateDebt,
  type DebtInput,
  type DebtPaymentRecord,
  type DebtRecord,
  type DebtSummary,
} from '../lib/api-debts';
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
  const { user, loading: userLoading } = useSupabaseUser();
  const canUseCloud = Boolean(user?.id);
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
  const [paymentList, setPaymentList] = useState<DebtPaymentRecord[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentDeletingId, setPaymentDeletingId] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<DebtRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [pendingPaymentDelete, setPendingPaymentDelete] = useState<DebtPaymentRecord | null>(null);

  const logError = useCallback((error: unknown, context: string) => {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error(`[HW][Debts] ${context}`, error);
    }
  }, []);

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
    if (!canUseCloud) {
      addToast('Masuk untuk mengelola pembayaran hutang.', 'error');
      return;
    }
    setPaymentDebt(debt);
    setPaymentOpen(true);
    setPaymentLoading(true);
    try {
      const detail = await getDebt(debt.id);
      if (detail.debt) {
        setPaymentDebt(detail.debt);
        setDebts((prev) => prev.map((item) => (item.id === detail.debt.id ? detail.debt : item)));
      }
      setPaymentList(detail.payments);
    } catch (error) {
      logError(error, 'load payments');
      addToast('Gagal memuat pembayaran', 'error');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePaymentSubmit = async (input: { amount: number; date: string; notes?: string | null }) => {
    if (!paymentDebt) return;
    if (!canUseCloud) {
      addToast('Masuk untuk mencatat pembayaran hutang.', 'error');
      return;
    }
    setPaymentSubmitting(true);
    const tempId = `temp-payment-${Date.now()}`;
    const optimisticPayment: DebtPaymentRecord = {
      id: tempId,
      debt_id: paymentDebt.id,
      user_id: paymentDebt.user_id,
      amount: input.amount,
      date: toISO(input.date) ?? new Date().toISOString(),
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    setPaymentList((prev) => [optimisticPayment, ...prev]);
    const previousDebt = paymentDebt;
    const updatedDebt: DebtRecord = {
      ...paymentDebt,
      paid_total: paymentDebt.paid_total + input.amount,
      remaining: Math.max(paymentDebt.remaining - input.amount, 0),
      status: computeStatus(paymentDebt.amount, paymentDebt.paid_total + input.amount, paymentDebt.due_date),
    };
    setPaymentDebt(updatedDebt);
    setDebts((prev) => prev.map((item) => (item.id === updatedDebt.id ? updatedDebt : item)));
    try {
      const result = await addPayment(paymentDebt.id, input);
      if (result.debt) {
        setPaymentDebt(result.debt);
        setDebts((prev) => prev.map((item) => (item.id === result.debt.id ? result.debt : item)));
      }
      setPaymentList((prev) => [result.payment, ...prev.filter((payment) => payment.id !== tempId)]);
      addToast('Pembayaran berhasil dicatat', 'success');
      await refreshData();
    } catch (error) {
      logError(error, 'add payment');
      setPaymentList((prev) => prev.filter((payment) => payment.id !== tempId));
      setPaymentDebt(previousDebt);
      setDebts((prev) => prev.map((item) => (item.id === previousDebt.id ? previousDebt : item)));
      addToast('Gagal mencatat pembayaran', 'error');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleDeletePayment = (payment: DebtPaymentRecord) => {
    setPendingPaymentDelete(payment);
  };

  const confirmDeletePayment = async () => {
    if (!pendingPaymentDelete || !paymentDebt) return;
    if (!canUseCloud) {
      addToast('Masuk untuk menghapus pembayaran hutang.', 'error');
      setPendingPaymentDelete(null);
      return;
    }
    const payment = pendingPaymentDelete;
    setPaymentDeletingId(payment.id);
    setPaymentList((prev) => prev.filter((item) => item.id !== payment.id));
    const backupDebt = paymentDebt;
    try {
      const updated = await deletePayment(payment.id);
      if (updated) {
        setPaymentDebt(updated);
        setDebts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      addToast('Pembayaran dihapus', 'success');
      await refreshData();
    } catch (error) {
      logError(error, 'delete payment');
      setPaymentList((prev) => [payment, ...prev]);
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
    setPaymentList([]);
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
            onClick={handleCreateClick}
            disabled={disableActions}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah Hutang/Piutang
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || disableActions}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface-1 px-4 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting ? 'Mengekspor…' : 'Export CSV'}
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
        loading={paymentLoading}
        submitting={paymentSubmitting}
        deletingId={paymentDeletingId}
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
