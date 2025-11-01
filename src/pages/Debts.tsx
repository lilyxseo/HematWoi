import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, Download, Plus } from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import SummaryCards from '../components/debts/SummaryCards';
import FilterBar, { DebtsFilterState } from '../components/debts/FilterBar';
import DebtsGrid from '../components/debts/DebtsGrid';
import DebtForm from '../components/debts/DebtForm';
import PaymentDrawer from '../components/debts/PaymentDrawer';
import ConfirmDialog from '../components/debts/ConfirmDialog';
import PaymentDeleteDialog from '../components/debts/PaymentDeleteDialog';
import { useToast } from '../context/ToastContext';
import {
  createDebt,
  createDebtPayment,
  createDebtPaymentWithTransaction,
  deleteDebt,
  deleteDebtPayment,
  getDebt,
  listDebts,
  updateDebt,
  type DebtInput,
  type DebtPaymentRecord,
  type DebtRecord,
  type DebtSummary,
} from '../lib/api-debts';
import useSupabaseUser from '../hooks/useSupabaseUser';
import { listAccounts, type AccountRecord } from '../lib/api';
import { listCategories, type CategoryRecord } from '../lib/api-categories';

const INITIAL_FILTERS: DebtsFilterState = {
  q: '',
  type: 'all',
  status: 'all',
  dateField: 'due_date',
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

const FILTER_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatFilterDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return FILTER_DATE_FORMATTER.format(date);
}

function getSeriesStartDate(debt: DebtRecord): string {
  if (!debt.date) return 'unknown';
  const parsed = new Date(debt.date);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  const offset = Math.max(0, Math.floor(debt.tenor_sequence) - 1);
  if (offset <= 0) {
    return parsed.toISOString();
  }
  const result = new Date(parsed.getTime());
  result.setUTCMonth(result.getUTCMonth() - offset);
  return result.toISOString();
}

function getTenorSeriesKey(debt: DebtRecord): string {
  if (debt.tenor_months <= 1) {
    return debt.id;
  }
  const normalizedParty = debt.party_name.trim().toLowerCase();
  const normalizedTitle = debt.title.trim().toLowerCase();
  const normalizedNotes = (debt.notes ?? '').trim().toLowerCase();
  const normalizedAmount = Number.isFinite(debt.amount) ? debt.amount.toFixed(2) : '0.00';
  const normalizedRate =
    debt.rate_percent != null && Number.isFinite(debt.rate_percent)
      ? debt.rate_percent.toFixed(4)
      : 'null';
  const createdAt = new Date(debt.created_at);
  const seriesIdentifier = Number.isNaN(createdAt.getTime()) ? getSeriesStartDate(debt) : createdAt.toISOString();
  return [
    debt.user_id,
    debt.type,
    normalizedParty,
    normalizedTitle,
    normalizedNotes,
    normalizedAmount,
    normalizedRate,
    debt.tenor_months,
    seriesIdentifier,
  ].join('|');
}

export default function Debts() {
  const { addToast } = useToast();
  const { user, loading: userLoading } = useSupabaseUser();
  const navigate = useNavigate();
  const canUseCloud = Boolean(user?.id);
  const [filters, setFilters] = useState<DebtsFilterState>(INITIAL_FILTERS);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [summary, setSummary] = useState<DebtSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDesktopFilterView, setIsDesktopFilterView] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(min-width: 768px)').matches;
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterPanelId = useId();
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
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<DebtRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [pendingPaymentDelete, setPendingPaymentDelete] = useState<DebtPaymentRecord | null>(null);
  const [seriesCursor, setSeriesCursor] = useState<Record<string, number>>({});

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

  useEffect(() => {
    if (!canUseCloud || !user?.id) {
      setCategories([]);
      setCategoriesLoading(false);
      return;
    }
    let cancelled = false;
    setCategoriesLoading(true);
    listCategories()
      .then((rows) => {
        if (cancelled) return;
        setCategories(rows);
      })
      .catch((error) => {
        if (cancelled) return;
        logError(error, 'load categories');
        addToast('Gagal memuat kategori transaksi.', 'error');
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canUseCloud, user?.id, addToast, logError]);

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
        tenor_months: payload.tenor_months,
        tenor_sequence: 1,
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
            tenor_months: payload.tenor_months,
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

  const multiTenorSeries = useMemo(() => {
    if (!debts.length) return new Map<string, { items: DebtRecord[]; defaultIndex: number }>();

    const groups = new Map<string, DebtRecord[]>();
    debts.forEach((item) => {
      if (item.tenor_months <= 1) return;
      const key = getTenorSeriesKey(item);
      const list = groups.get(key);
      if (list) {
        list.push(item);
      } else {
        groups.set(key, [item]);
      }
    });

    const series = new Map<string, { items: DebtRecord[]; defaultIndex: number }>();
    groups.forEach((list, key) => {
      if (!list.length) return;
      const sorted = list.slice().sort((a, b) => {
        if (a.tenor_sequence !== b.tenor_sequence) {
          return a.tenor_sequence - b.tenor_sequence;
        }
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();
        if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
          return 0;
        }
        return aTime - bTime;
      });
      let defaultIndex = sorted.findIndex((entry) => entry.status !== 'paid');
      if (defaultIndex === -1) {
        defaultIndex = sorted.length - 1;
      }
      series.set(key, { items: sorted, defaultIndex });
    });

    return series;
  }, [debts]);

  useEffect(() => {
    setSeriesCursor((prev) => {
      if (multiTenorSeries.size === 0) {
        return Object.keys(prev).length ? {} : prev;
      }
      let changed = false;
      const next: Record<string, number> = {};
      multiTenorSeries.forEach(({ items, defaultIndex }, key) => {
        const maxIndex = Math.max(0, items.length - 1);
        let value = prev[key];
        if (typeof value !== 'number' || Number.isNaN(value)) {
          value = defaultIndex;
        }
        if (value < 0) value = 0;
        if (value > maxIndex) value = maxIndex;
        next[key] = value;
        if (value !== prev[key]) {
          changed = true;
        }
      });
      if (Object.keys(prev).length !== multiTenorSeries.size) {
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [multiTenorSeries]);

  const { visibleDebts, tenorNavigation } = useMemo(() => {
    if (!debts.length) {
      return {
        visibleDebts: [] as DebtRecord[],
        tenorNavigation: {} as Record<
          string,
          { key: string; hasPrev: boolean; hasNext: boolean; currentIndex: number; total: number }
        >,
      };
    }

    const processed = new Set<string>();
    const result: DebtRecord[] = [];
    const navigation: Record<
      string,
      { key: string; hasPrev: boolean; hasNext: boolean; currentIndex: number; total: number }
    > = {};

    debts.forEach((item) => {
      if (item.tenor_months <= 1) {
        result.push(item);
        return;
      }

      const key = getTenorSeriesKey(item);
      if (processed.has(key)) {
        return;
      }
      processed.add(key);

      const series = multiTenorSeries.get(key);
      if (!series || series.items.length === 0) {
        result.push(item);
        return;
      }

      const { items, defaultIndex } = series;
      const maxIndex = Math.max(0, items.length - 1);
      const cursor = seriesCursor[key];
      const selectedIndex = Math.max(0, Math.min(typeof cursor === 'number' ? cursor : defaultIndex, maxIndex));
      const selectedDebt = items[selectedIndex];
      result.push(selectedDebt);
      navigation[selectedDebt.id] = {
        key,
        hasPrev: selectedIndex > 0,
        hasNext: selectedIndex < maxIndex,
        currentIndex: selectedIndex,
        total: items.length,
      };
    });

    return { visibleDebts: result, tenorNavigation: navigation };
  }, [debts, multiTenorSeries, seriesCursor]);

  const dateFilterSummary = useMemo(() => {
    if (!filters.dateFrom && !filters.dateTo) {
      return null;
    }

    const total = debts.reduce((sum, debt) => {
      if (debt.type !== 'debt') return sum;
      if (typeof debt.amount !== 'number' || !Number.isFinite(debt.amount)) {
        return sum;
      }
      return sum + debt.amount;
    }, 0);

    const fromLabel = formatFilterDate(filters.dateFrom);
    const toLabel = formatFilterDate(filters.dateTo);
    const fieldLabel = filters.dateField === 'created_at' ? 'tanggal dibuat' : 'tanggal jatuh tempo';

    let rangeDescription = '';
    if (fromLabel && toLabel) {
      rangeDescription =
        filters.dateFrom === filters.dateTo ? `pada ${fromLabel}` : `pada rentang ${fromLabel} – ${toLabel}`;
    } else if (fromLabel) {
      rangeDescription = `sejak ${fromLabel}`;
    } else if (toLabel) {
      rangeDescription = `hingga ${toLabel}`;
    }

    return {
      total,
      description: `Nominal hutang berdasarkan ${fieldLabel}${rangeDescription ? ` ${rangeDescription}` : ''}`,
    };
  }, [filters.dateFrom, filters.dateTo, filters.dateField, debts]);

  const handleNavigateTenor = useCallback(
    (seriesKey: string, direction: 1 | -1) => {
      const series = multiTenorSeries.get(seriesKey);
      if (!series || series.items.length === 0) return;
      const maxIndex = Math.max(0, series.items.length - 1);
      setSeriesCursor((prev) => {
        const current = Math.max(
          0,
          Math.min(typeof prev[seriesKey] === 'number' ? prev[seriesKey] : series.defaultIndex, maxIndex),
        );
        const nextIndex = Math.max(0, Math.min(current + direction, maxIndex));
        if (nextIndex === current) return prev;
        return {
          ...prev,
          [seriesKey]: nextIndex,
        };
      });
    },
    [multiTenorSeries],
  );

  const handleExport = async () => {
    if (!canUseCloud) {
      addToast('Masuk untuk mengekspor daftar hutang.', 'error');
      return;
    }
    try {
      setExporting(true);
      if (!visibleDebts.length) {
        addToast('Tidak ada data untuk diekspor', 'info');
        return;
      }
      const headers = [
        'Tipe',
        'Pihak',
        'Judul',
        'Jatuh Tempo',
        'Tenor',
        'Jumlah',
        'Terbayar',
        'Sisa',
        'Status',
        'Catatan',
      ];
      const rows = visibleDebts.map((item) => [
        item.type === 'debt' ? 'Hutang' : 'Piutang',
        item.party_name,
        item.title,
        item.due_date ? new Date(item.due_date).toLocaleDateString('id-ID') : '',
        `${item.tenor_sequence}/${item.tenor_months}`,
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
    setAccountsLoading(true);
    if (user?.id) {
      listAccounts(user.id)
        .then((rows) => setAccounts(rows))
        .catch((error) => {
          logError(error, 'load accounts');
          addToast('Gagal memuat akun sumber pembayaran.', 'error');
        })
        .finally(() => {
          setAccountsLoading(false);
        });
    } else {
      setAccounts([]);
      setAccountsLoading(false);
    }
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

  const handlePaymentSubmit = async (input: {
    amount: number;
    date: string;
    notes?: string | null;
    includeTransaction: boolean;
    accountId?: string | null;
    categoryId?: string | null;
    markAsPaid: boolean;
    allowOverpay: boolean;
  }) => {
    if (!paymentDebt) return;
    if (!canUseCloud) {
      addToast('Masuk untuk mencatat pembayaran hutang.', 'error');
      return;
    }

    const isReceivable = paymentDebt.type === 'receivable';
    const requiredCategoryType = isReceivable ? 'income' : 'expense';
    const hasCategoryForType = categories.some((item) => item.type === requiredCategoryType);
    const includeTransaction = Boolean(
      input.includeTransaction &&
        input.accountId &&
        (isReceivable || !hasCategoryForType || input.categoryId),
    );
    const accountId = includeTransaction ? String(input.accountId ?? '') : '';
    const categoryId = includeTransaction ? String(input.categoryId ?? '') : '';

    if (input.includeTransaction && !input.accountId) {
      addToast('Pilih akun untuk mencatat transaksi.', 'error');
      return;
    }
    if (input.includeTransaction && !isReceivable && hasCategoryForType && !categoryId) {
      addToast('Pilih kategori transaksi.', 'error');
      return;
    }

    setPaymentSubmitting(true);
    const tempId = `temp-payment-${Date.now()}`;
    const selectedAccount = includeTransaction ? accounts.find((item) => item.id === accountId) : undefined;
    const optimisticPayment: DebtPaymentRecord = {
      id: tempId,
      debt_id: paymentDebt.id,
      user_id: paymentDebt.user_id,
      amount: input.amount,
      date: toISO(input.date) ?? new Date().toISOString(),
      notes: input.notes ?? null,
      account_id: includeTransaction ? accountId : null,
      account_name: includeTransaction ? selectedAccount?.name ?? null : null,
      transaction_id: null,
      created_at: new Date().toISOString(),
    };
    setPaymentList((prev) => [optimisticPayment, ...prev]);
    const previousDebt = paymentDebt;
    const optimisticRemaining = Math.max(paymentDebt.remaining - input.amount, 0);
    let optimisticStatus = computeStatus(paymentDebt.amount, paymentDebt.paid_total + input.amount, paymentDebt.due_date);
    if (!input.markAsPaid && optimisticRemaining <= 0.0001) {
      optimisticStatus = 'ongoing';
    } else if (input.markAsPaid && optimisticRemaining <= 0.0001) {
      optimisticStatus = 'paid';
    }
    const updatedDebt: DebtRecord = {
      ...paymentDebt,
      paid_total: paymentDebt.paid_total + input.amount,
      remaining: optimisticRemaining,
      status: optimisticStatus,
    };
    setPaymentDebt(updatedDebt);
    setDebts((prev) => prev.map((item) => (item.id === updatedDebt.id ? updatedDebt : item)));

    try {
      const result = includeTransaction
        ? await createDebtPaymentWithTransaction(paymentDebt.id, {
            amount: input.amount,
            date: input.date,
            notes: input.notes ?? null,
            account_id: accountId,
            category_id: categoryId || null,
            markAsPaid: input.markAsPaid,
            allowOverpay: input.allowOverpay,
          })
        : await createDebtPayment(paymentDebt.id, {
            amount: input.amount,
            date: input.date,
            notes: input.notes ?? null,
            markAsPaid: input.markAsPaid,
            allowOverpay: input.allowOverpay,
          });
      if (result.debt) {
        const resolvedDebt = result.debt;
        setPaymentDebt(resolvedDebt);
        setDebts((prev) => prev.map((item) => (item.id === resolvedDebt.id ? resolvedDebt : item)));
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

  const confirmDeletePayment = async (withRollback: boolean) => {
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
      const updated = await deleteDebtPayment({ id: payment.id, withRollback });
      if (updated) {
        setPaymentDebt(updated);
        setDebts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      addToast(withRollback ? 'Pembayaran dan transaksi dihapus' : 'Pembayaran dihapus', 'success');
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

  const handleViewTransaction = (transactionId: string) => {
    handleClosePayment();
    navigate(`/transactions?transactionId=${transactionId}`);
  };

  const pageDescription = useMemo(
    () => 'Kelola hutang dan piutang dengan pencatatan pembayaran terkontrol.',
    [],
  );

  const disableActions = !canUseCloud;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopFilterView(event.matches);
    };

    setIsDesktopFilterView(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const isFilterPanelVisible = isDesktopFilterView || filterPanelOpen;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.q.trim()) count += 1;
    if (filters.type !== 'all') count += 1;
    if (filters.status !== 'all') count += 1;
    if (filters.dateField !== 'due_date') count += 1;
    if (filters.dateFrom) count += 1;
    if (filters.dateTo) count += 1;
    if (filters.sort !== 'newest') count += 1;
    return count;
  }, [filters]);

  const toggleFilterPanel = () => {
    if (isDesktopFilterView) return;
    setFilterPanelOpen((prev) => !prev);
  };

  return (
    <Page maxWidthClassName="max-w-[1400px]" paddingClassName="px-3 sm:px-4 md:px-6">
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

        <div className="space-y-6">
          <div className="space-y-3">
            <button
              type="button"
              onClick={toggleFilterPanel}
              className={clsx(
                'md:hidden flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-surface-1/90 px-4 py-3 text-sm font-semibold text-text shadow-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]',
              )}
              aria-controls={filterPanelId}
              aria-expanded={isDesktopFilterView ? true : filterPanelOpen}
            >
              <span className="flex items-center gap-2">
                Filter
                {activeFilterCount > 0 ? (
                  <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={clsx(
                  'h-4 w-4 text-muted transition-transform duration-200',
                  isFilterPanelVisible ? 'rotate-180' : 'rotate-0',
                )}
                aria-hidden="true"
              />
            </button>

            <div
              id={filterPanelId}
              aria-hidden={!isDesktopFilterView && !isFilterPanelVisible}
              className={clsx(
                'transition-[max-height,opacity] duration-200 ease-in-out',
                'md:max-h-none md:opacity-100 md:transition-none md:overflow-visible md:pointer-events-auto',
                !isDesktopFilterView && 'overflow-hidden',
                !isDesktopFilterView && isFilterPanelVisible && 'mt-3',
                !isDesktopFilterView && !isFilterPanelVisible && 'pointer-events-none',
                isFilterPanelVisible ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0',
              )}
            >
              <FilterBar
                filters={filters}
                onChange={setFilters}
                onReset={() => setFilters(INITIAL_FILTERS)}
              />
            </div>
          </div>

          {dateFilterSummary ? (
            <div className="rounded-3xl border border-border/60 bg-surface-1/90 px-4 py-3 text-sm text-muted-foreground">
              <span>{dateFilterSummary.description}:</span>{' '}
              <span className="font-semibold text-foreground">{formatCurrency(dateFilterSummary.total)}</span>
            </div>
          ) : null}

          {!userLoading && !canUseCloud ? (
            <div className="rounded-3xl border border-dashed border-border bg-surface-2/70 px-4 py-3 text-sm text-muted">
              Mode offline aktif. Masuk untuk melihat dan mengelola data hutang yang tersimpan di cloud.
            </div>
          ) : null}

          <SummaryCards summary={summary} />

      <section className="min-w-0">
        <DebtsGrid
          debts={visibleDebts}
          loading={loading}
          onEdit={handleEditClick}
          onDelete={handleDeleteRequest}
          onAddPayment={handleOpenPayment}
          tenorNavigation={tenorNavigation}
          onNavigateTenor={handleNavigateTenor}
        />
      </section>
        </div>
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
        accounts={accounts}
        accountsLoading={accountsLoading}
        categories={categories}
        categoriesLoading={categoriesLoading}
        onClose={handleClosePayment}
        onSubmit={handlePaymentSubmit}
        onDeletePayment={handleDeletePayment}
        onViewTransaction={handleViewTransaction}
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

      <PaymentDeleteDialog
        open={Boolean(pendingPaymentDelete)}
        payment={pendingPaymentDelete}
        loading={Boolean(paymentDeletingId)}
        onDelete={confirmDeletePayment}
        onCancel={() => {
          if (!paymentDeletingId) setPendingPaymentDelete(null);
        }}
      />
    </Page>
  );
}
