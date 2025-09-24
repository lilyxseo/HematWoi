import { useCallback, useEffect, useMemo, useState } from 'react';
import Page from '../layout/Page.jsx';
import PageHeader from '../layout/PageHeader.jsx';
import Section from '../layout/Section.jsx';
import SummaryCards from '../components/subscriptions/SummaryCards';
import SubscriptionsFilterBar, {
  type SubscriptionFilterState,
  type FilterOption,
} from '../components/subscriptions/SubscriptionsFilterBar';
import SubscriptionCard from '../components/subscriptions/SubscriptionCard';
import UpcomingTable from '../components/subscriptions/UpcomingTable';
import UpcomingCardList from '../components/subscriptions/UpcomingCardList';
import SubscriptionForm, {
  type SubscriptionFormSubmitPayload,
} from '../components/subscriptions/SubscriptionForm';
import ErrorBoundary from '../components/system/ErrorBoundary';
import { useToast } from '../context/ToastContext.jsx';
import {
  createSubscription,
  deleteSubscription,
  getMonthlyForecast,
  markPaid,
  skipOnce,
  updateSubscription,
  type SubscriptionChargeRecord,
  type SubscriptionRecord,
} from '../lib/api-subscriptions';
import { listSubscriptions as fetchSubscriptionsList, listUpcomingCharges as fetchUpcomingCharges } from '../lib/api';
import { exportSubscriptionsCsv } from '../lib/subscriptions-csv';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/session';

const DEFAULT_FILTERS: SubscriptionFilterState = {
  q: '',
  status: 'all',
  categoryId: 'all',
  accountId: 'all',
  unit: 'all',
  dueFrom: null,
  dueTo: null,
  createdFrom: null,
  createdTo: null,
  sort: 'due-asc',
  open: false,
};

const emptySummary = {
  totalActive: 0,
  forecastAmount: 0,
  paidAmount: 0,
  dueSoonCount: 0,
  dueSoonAmount: 0,
};

function startOfMonthFrom(value?: string | null): string {
  if (value && value.length >= 7) {
    return `${value.slice(0, 7)}-01`;
  }
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return monthStart.toISOString().slice(0, 10);
}

function computeDueSoon(charges: SubscriptionChargeRecord[]) {
  const now = new Date();
  const limit = new Date(now);
  limit.setDate(limit.getDate() + 7);
  return charges
    .filter((charge) => {
      if (!charge.due_date) return false;
      if (charge.status === 'paid' || charge.status === 'skipped' || charge.status === 'canceled') {
        return false;
      }
      const due = new Date(charge.due_date);
      return due >= now && due <= limit;
    })
    .reduce(
      (acc, charge) => {
        acc.count += 1;
        acc.amount += Number.isFinite(charge.amount) ? charge.amount : 0;
        return acc;
      },
      { count: 0, amount: 0 },
    );
}

function compareNullableDates(
  a: string | null | undefined,
  b: string | null | undefined,
  ascending: boolean,
) {
  if (!a && !b) return 0;
  if (!a) return ascending ? -1 : 1;
  if (!b) return ascending ? 1 : -1;
  if (a === b) return 0;
  return ascending ? (a < b ? -1 : 1) : (a > b ? -1 : 1);
}

function applySubscriptionFilters(
  list: SubscriptionRecord[],
  filters: SubscriptionFilterState,
): SubscriptionRecord[] {
  const searchTerm = filters.q?.trim().toLowerCase() ?? '';
  const statusFilter = filters.status && filters.status !== 'all' ? filters.status : null;
  const categoryFilter =
    filters.categoryId && filters.categoryId !== 'all' ? filters.categoryId : null;
  const accountFilter = filters.accountId && filters.accountId !== 'all' ? filters.accountId : null;
  const unitFilter = filters.unit && filters.unit !== 'all' ? filters.unit : null;
  const dueFrom = filters.dueFrom ?? null;
  const dueTo = filters.dueTo ?? null;
  const createdFrom = filters.createdFrom ?? null;
  const createdTo = filters.createdTo ?? null;

  const filtered = list.filter((item) => {
    if (statusFilter && item.status !== statusFilter) {
      return false;
    }
    if (categoryFilter && item.category_id !== categoryFilter) {
      return false;
    }
    if (accountFilter && item.account_id !== accountFilter) {
      return false;
    }
    if (unitFilter && item.interval_unit !== unitFilter) {
      return false;
    }
    if (dueFrom) {
      if (!item.next_due_date || item.next_due_date < dueFrom) {
        return false;
      }
    }
    if (dueTo) {
      if (!item.next_due_date || item.next_due_date > dueTo) {
        return false;
      }
    }
    const createdDate = item.created_at ? item.created_at.slice(0, 10) : null;
    if (createdFrom && (!createdDate || createdDate < createdFrom)) {
      return false;
    }
    if (createdTo && (!createdDate || createdDate > createdTo)) {
      return false;
    }
    if (searchTerm) {
      const nameMatch = item.name?.toLowerCase().includes(searchTerm);
      const vendorMatch = item.vendor?.toLowerCase().includes(searchTerm);
      if (!nameMatch && !vendorMatch) {
        return false;
      }
    }
    return true;
  });

  const sortKey = filters.sort ?? 'due-asc';
  const sorted = [...filtered];

  sorted.sort((a, b) => {
    switch (sortKey) {
      case 'name-asc':
        return (a.name ?? '').localeCompare(b.name ?? '');
      case 'name-desc':
        return (b.name ?? '').localeCompare(a.name ?? '');
      case 'amount-asc':
        return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      case 'amount-desc':
        return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      case 'created-asc': {
        const aDate = a.created_at ?? '';
        const bDate = b.created_at ?? '';
        return aDate.localeCompare(bDate);
      }
      case 'created-desc': {
        const aDate = a.created_at ?? '';
        const bDate = b.created_at ?? '';
        return bDate.localeCompare(aDate);
      }
      case 'due-desc':
        return compareNullableDates(a.next_due_date, b.next_due_date, false);
      case 'due-asc':
      default:
        return compareNullableDates(a.next_due_date, b.next_due_date, true);
    }
  });

  return sorted;
}

export default function SubscriptionsPage() {
  const { addToast } = useToast();
  const [filters, setFilters] = useState<SubscriptionFilterState>(DEFAULT_FILTERS);
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [accounts, setAccounts] = useState<FilterOption[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);
  const [upcomingRaw, setUpcomingRaw] = useState<SubscriptionChargeRecord[]>([]);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [summary, setSummary] = useState(emptySummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionRecord | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [selectedChargeIds, setSelectedChargeIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [autoCreateTransaction, setAutoCreateTransaction] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchOptions() {
      try {
        const [catRes, accRes] = await Promise.all([
          supabase.from('categories').select('id, name').order('name'),
          supabase.from('accounts').select('id, name').order('name'),
        ]);
        if (!active) return;
        if (catRes.error) throw catRes.error;
        if (accRes.error) throw accRes.error;
        const catOptions: FilterOption[] = (catRes.data ?? [])
          .filter((row): row is { id: string; name: string } => Boolean(row?.id))
          .map((row) => ({ id: row.id!, name: row.name ?? 'Kategori' }));
        const accOptions: FilterOption[] = (accRes.data ?? [])
          .filter((row): row is { id: string; name: string } => Boolean(row?.id))
          .map((row) => ({ id: row.id!, name: row.name ?? 'Akun' }));
        setCategories(catOptions);
        setAccounts(accOptions);
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Gagal memuat referensi. Cek koneksi atau ulangi.';
        addToast(`Gagal memuat kategori/akun: ${message}`, 'danger');
      }
    }
    fetchOptions();
    return () => {
      active = false;
    };
  }, [addToast]);

  const loadLists = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('Gagal memuat langganan. Pengguna tidak ditemukan.');
    }
    const [subsRes, chargesRes] = await Promise.all([
      fetchSubscriptionsList(userId),
      fetchUpcomingCharges(userId),
    ]);
    return { subsRes, chargesRes };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingSubs(true);
    setLoadingUpcoming(true);
    setSubscriptionsError(null);
    setUpcomingError(null);

    loadLists()
      .then(({ subsRes, chargesRes }) => {
        if (!active) return;

        if (subsRes.error) {
          setAllSubscriptions([]);
          setSubscriptionsError('Gagal memuat langganan. Coba lagi.');
          addToast('Gagal memuat langganan. Coba lagi.', 'danger');
        } else {
          setSubscriptionsError(null);
          setAllSubscriptions((subsRes.data ?? []) as SubscriptionRecord[]);
        }

        if (chargesRes.error) {
          setUpcomingRaw([]);
          setUpcomingError('Gagal memuat tagihan. Coba lagi.');
          addToast('Gagal memuat tagihan. Coba lagi.', 'danger');
        } else {
          setUpcomingError(null);
          setUpcomingRaw((chargesRes.data ?? []) as SubscriptionChargeRecord[]);
        }
      })
      .catch((error) => {
        if (!active) return;
        setAllSubscriptions([]);
        setUpcomingRaw([]);
        setSubscriptionsError('Gagal memuat langganan. Coba lagi.');
        setUpcomingError('Gagal memuat tagihan. Coba lagi.');
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Gagal memuat langganan. Coba lagi.';
        addToast(message, 'danger');
      })
      .finally(() => {
        if (active) {
          setLoadingSubs(false);
          setLoadingUpcoming(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loadLists, addToast]);

  useEffect(() => {
    let active = true;

    async function fetchSummary() {
      setSummaryLoading(true);
      try {
        const period = startOfMonthFrom(filters.dueFrom);
        const row = await getMonthlyForecast(period);
        if (!active) return;
        setSummary((prev) => ({
          ...prev,
          forecastAmount: row?.due_amount ?? 0,
          paidAmount: row?.paid_amount ?? 0,
        }));
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Gagal memuat ringkasan. Cek koneksi atau ulangi.';
        addToast(message, 'danger');
      } finally {
        if (active) setSummaryLoading(false);
      }
    }

    fetchSummary();

    return () => {
      active = false;
    };
  }, [filters, addToast]);

  const filteredSubscriptions = useMemo(
    () => applySubscriptionFilters(allSubscriptions, filters),
    [allSubscriptions, filters],
  );

  const upcoming = useMemo(() => {
    if (!Array.isArray(upcomingRaw)) return [];
    return upcomingRaw.filter((charge) => {
      const subscription = charge.subscription;
      if (!subscription) return true;
      if (filters.status !== 'all' && subscription.status !== filters.status) return false;
      if (filters.categoryId !== 'all' && subscription.category_id !== filters.categoryId) return false;
      if (filters.accountId !== 'all' && subscription.account_id !== filters.accountId) return false;
      if (filters.unit !== 'all' && subscription.interval_unit !== filters.unit) return false;
      if (filters.dueFrom && charge.due_date < filters.dueFrom) {
        return false;
      }
      if (filters.dueTo && charge.due_date > filters.dueTo) {
        return false;
      }
      if (filters.q) {
        const term = filters.q.toLowerCase();
        const matchName = subscription.name?.toLowerCase().includes(term);
        const matchVendor = subscription.vendor?.toLowerCase().includes(term);
        if (!matchName && !matchVendor) {
          return false;
        }
      }
      return true;
    });
  }, [upcomingRaw, filters]);

  useEffect(() => {
    setSelectedChargeIds((prev) => prev.filter((id) => upcoming.some((charge) => charge.id === id)));
  }, [upcoming]);

  useEffect(() => {
    const dueSoon = computeDueSoon(upcoming);
    setSummary((prev) => ({
      ...prev,
      totalActive: filteredSubscriptions.filter((sub) => sub.status === 'active').length,
      dueSoonCount: dueSoon.count,
      dueSoonAmount: dueSoon.amount,
    }));
  }, [filteredSubscriptions, upcoming]);

  const handleFilterChange = useCallback((next: Partial<SubscriptionFilterState>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleOpenForm = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((id: string) => {
    const target = filteredSubscriptions.find((item) => item.id === id) ?? null;
    if (!target) {
      addToast('Langganan tidak ditemukan', 'danger');
      return;
    }
    setEditing(target);
    setFormOpen(true);
  }, [filteredSubscriptions, addToast]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const { subsRes, chargesRes } = await loadLists();
      if (subsRes.error) {
        setAllSubscriptions([]);
        setSubscriptionsError('Gagal memuat langganan. Coba lagi.');
        throw subsRes.error;
      }
      if (chargesRes.error) {
        setUpcomingRaw([]);
        setUpcomingError('Gagal memuat tagihan. Coba lagi.');
        throw chargesRes.error;
      }
      setSubscriptionsError(null);
      setUpcomingError(null);
      setAllSubscriptions((subsRes.data ?? []) as SubscriptionRecord[]);
      setUpcomingRaw((chargesRes.data ?? []) as SubscriptionChargeRecord[]);
    } catch (_error) {
      addToast('Gagal memuat ulang data. Cek koneksi atau ulangi.', 'danger');
    }
  }, [loadLists, addToast]);

  const handleFormSubmit = useCallback(
    async (payload: SubscriptionFormSubmitPayload) => {
      setSavingForm(true);
      try {
        if (payload.id) {
          await updateSubscription(payload.id, payload);
          addToast('Langganan diperbarui.', 'success');
        } else {
          await createSubscription(payload);
          addToast('Langganan ditambahkan.', 'success');
        }
        closeForm();
        await refreshData();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menyimpan. Cek koneksi atau ulangi.';
        addToast(message, 'danger');
        throw error;
      } finally {
        setSavingForm(false);
      }
    },
    [addToast, closeForm, refreshData],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!globalThis.confirm?.('Yakin ingin menghapus langganan ini?')) {
        return;
      }
      try {
        await deleteSubscription(id);
        addToast('Langganan dihapus.', 'success');
        await refreshData();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menghapus. Cek koneksi atau ulangi.';
        addToast(message, 'danger');
      }
    },
    [addToast, refreshData],
  );

  const handleToggleStatus = useCallback(
    async (id: string, next: SubscriptionRecord['status']) => {
      try {
        await updateSubscription(id, { status: next });
        addToast('Status langganan diperbarui.', 'success');
        await refreshData();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal mengubah status. Cek koneksi atau ulangi.';
        addToast(message, 'danger');
      }
    },
    [addToast, refreshData],
  );

  const handleMarkPaid = useCallback(
    async (chargeId: string) => {
      try {
        const result = await markPaid(chargeId, { createTransaction: autoCreateTransaction });
        if (result.transactionError) {
          addToast('Tagihan dibayar, namun transaksi tidak tercatat.', 'warning');
        } else {
          addToast('Tagihan ditandai paid.', 'success');
        }
        await refreshData();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menandai paid. Cek koneksi atau ulangi.';
        addToast(message, 'danger');
      }
    },
    [addToast, refreshData, autoCreateTransaction],
  );

  const handleSkip = useCallback(
    async (chargeId: string, dueDate: string) => {
      try {
        const charge = upcoming.find((item) => item.id === chargeId);
        if (!charge) {
          addToast('Tagihan tidak ditemukan.', 'danger');
          return;
        }
        const subscriptionId = charge.subscription_id ?? charge.subscription?.id;
        if (!subscriptionId) {
          addToast('Langganan tidak ditemukan.', 'danger');
          return;
        }
        if (!dueDate) {
          addToast('Tanggal jatuh tempo tidak valid.', 'danger');
          return;
        }
        await skipOnce(subscriptionId, dueDate);
        addToast('Tagihan diskip sekali.', 'success');
        await refreshData();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal skip tagihan. Cek koneksi atau ulangi.';
        addToast(message, 'danger');
      }
    },
    [addToast, refreshData, upcoming],
  );

  const toggleSelectCharge = useCallback((id: string, selected: boolean) => {
    setSelectedChargeIds((prev) => {
      const set = new Set(prev);
      if (selected) {
        set.add(id);
      } else {
        set.delete(id);
      }
      return Array.from(set);
    });
  }, []);

  const toggleSelectAll = useCallback((selected: boolean) => {
    if (!selected) {
      setSelectedChargeIds([]);
      return;
    }
    setSelectedChargeIds(upcoming.map((charge) => charge.id));
  }, [upcoming]);

  const handleBulkMarkPaid = useCallback(async () => {
    if (!selectedChargeIds.length) return;
    setBulkProcessing(true);
    let hasError = false;
    let hasWarning = false;
    try {
      for (const id of selectedChargeIds) {
        try {
          const result = await markPaid(id, { createTransaction: autoCreateTransaction });
          if (result.transactionError) {
            hasWarning = true;
          }
        } catch (error) {
          hasError = true;
          const message = error instanceof Error ? error.message : 'Gagal memproses salah satu tagihan.';
          addToast(message, 'danger');
        }
      }
      if (!hasError) {
        addToast('Tagihan terpilih ditandai paid.', 'success');
      }
      if (hasWarning) {
        addToast('Sebagian transaksi gagal dibuat.', 'warning');
      }
      setSelectedChargeIds([]);
      await refreshData();
    } finally {
      setBulkProcessing(false);
    }
  }, [selectedChargeIds, autoCreateTransaction, refreshData, addToast]);

  const handleBulkSkip = useCallback(async () => {
    if (!selectedChargeIds.length) return;
    setBulkProcessing(true);
    let hasError = false;
    try {
      for (const id of selectedChargeIds) {
        const charge = upcoming.find((item) => item.id === id);
        if (!charge) continue;
        const subscriptionId = charge.subscription_id ?? charge.subscription?.id;
        if (!subscriptionId) {
          hasError = true;
          addToast('Langganan tidak ditemukan.', 'danger');
          continue;
        }
        if (!charge.due_date) {
          hasError = true;
          addToast('Tanggal jatuh tempo tidak valid.', 'danger');
          continue;
        }
        try {
          await skipOnce(subscriptionId, charge.due_date);
        } catch (error) {
          hasError = true;
          const message = error instanceof Error ? error.message : 'Gagal skip salah satu tagihan.';
          addToast(message, 'danger');
        }
      }
      if (!hasError) {
        addToast('Tagihan terpilih diskip sekali.', 'success');
      }
      setSelectedChargeIds([]);
      await refreshData();
    } finally {
      setBulkProcessing(false);
    }
  }, [selectedChargeIds, upcoming, refreshData, addToast]);

  const handleExport = useCallback(async () => {
    try {
      await exportSubscriptionsCsv({
        subscriptions: filteredSubscriptions,
        charges: upcoming,
        filters,
      });
      addToast('CSV langganan siap diunduh.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengekspor CSV. Cek koneksi atau ulangi.';
      addToast(message, 'danger');
    }
  }, [filteredSubscriptions, upcoming, filters, addToast]);

  useEffect(() => {
    if (import.meta.env?.VITE_ENABLE_REALTIME !== 'true') {
      return;
    }
    const channel = supabase
      .channel('subscriptions-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_charges' }, () => {
        refreshData();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [refreshData]);

  const bulkCount = selectedChargeIds.length;

  return (
    <ErrorBoundary>
      <Page>
        <PageHeader
          title="Langganan"
          description="Kelola semua langganan, jadwal tagihan, dan riwayat pembayaran."
        >
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface-2 px-4 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleOpenForm}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-primary bg-primary px-4 text-sm font-semibold text-white shadow focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Tambah Langganan
          </button>
        </PageHeader>

        <Section first>
          <SummaryCards
            totalActive={summary.totalActive}
            forecastAmount={summary.forecastAmount}
            paidAmount={summary.paidAmount}
            dueSoonCount={summary.dueSoonCount}
            dueSoonAmount={summary.dueSoonAmount}
            loading={summaryLoading}
          />
        </Section>

        <Section>
          <SubscriptionsFilterBar
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
            categories={categories}
            accounts={accounts}
          />
        </Section>

        <Section>
          <div className="grid gap-4">
            {loadingSubs && (
              <div className="rounded-3xl border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-muted">
                Memuat langganan…
              </div>
            )}
            {!loadingSubs && subscriptionsError && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {subscriptionsError}
              </div>
            )}
            {!loadingSubs && !subscriptionsError && filteredSubscriptions.length === 0 && (
              <div className="rounded-3xl border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-muted">
                Belum ada langganan. Tambah langganan pertama Anda.
              </div>
            )}
            {!loadingSubs && !subscriptionsError && filteredSubscriptions.length > 0 && (
              <div className="grid gap-4">
                {filteredSubscriptions.map((subscription) => (
                  <SubscriptionCard
                    key={subscription.id}
                    subscription={subscription}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-3xl border border-border-subtle bg-surface px-4 py-3 shadow-sm shadow-black/5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-text">Upcoming charges</h3>
                <p className="text-xs text-muted">Pantau tagihan 90 hari ke depan dan lakukan aksi cepat.</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoCreateTransaction}
                  onChange={(event) => setAutoCreateTransaction(event.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span>Buat transaksi otomatis saat Paid</span>
              </label>
            </div>
            {bulkCount > 0 && (
              <div className="sticky top-[72px] z-20 flex flex-col gap-2 rounded-3xl border border-border-subtle bg-surface px-4 py-3 shadow-md shadow-black/10 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-text">
                  {bulkCount} tagihan dipilih
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleBulkMarkPaid}
                    disabled={bulkProcessing}
                    className="inline-flex h-10 items-center rounded-2xl border border-primary bg-primary/90 px-4 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Tandai Paid ({bulkCount})
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkSkip}
                    disabled={bulkProcessing}
                    className="inline-flex h-10 items-center rounded-2xl border border-border bg-surface-2 px-4 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Skip ({bulkCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedChargeIds([])}
                    className="inline-flex h-10 items-center rounded-2xl border border-border bg-surface-2 px-4 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    Batalkan
                  </button>
                </div>
              </div>
            )}
            {!loadingUpcoming && upcomingError && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-center text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {upcomingError}
              </div>
            )}
            <UpcomingTable
              charges={upcoming}
              selectedIds={selectedChargeIds}
              loading={loadingUpcoming}
              onToggleSelect={toggleSelectCharge}
              onToggleSelectAll={toggleSelectAll}
              onMarkPaid={handleMarkPaid}
              onSkip={handleSkip}
            />
            <UpcomingCardList
              charges={upcoming}
              selectedIds={selectedChargeIds}
              loading={loadingUpcoming}
              onToggleSelect={toggleSelectCharge}
              onMarkPaid={handleMarkPaid}
              onSkip={handleSkip}
            />
          </div>
        </Section>
      </Page>

      <SubscriptionForm
        open={formOpen}
        initial={editing}
        categories={categories}
        accounts={accounts}
        saving={savingForm}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
      />
    </ErrorBoundary>
  );
}
