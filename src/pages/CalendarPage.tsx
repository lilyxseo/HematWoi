import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addMonths, format, isSameMonth, parseISO, startOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import CalendarGrid from '../components/calendar/CalendarGrid';
import Filters from '../components/calendar/Filters';
import DayDetailModal from '../components/calendar/DayDetailModal';
import useMonthAggregates from '../hooks/useMonthAggregates';
import useDayTransactions from '../hooks/useDayTransactions';
import { normalizeCalendarFilter, type CalendarFilter } from '../lib/calendarApi';
import { formatCurrency } from '../lib/format';
import useCategories from '../hooks/useCategories';
import useSupabaseUser from '../hooks/useSupabaseUser';
import { listAccounts, type AccountRecord } from '../lib/api';
import { removeTransaction } from '../lib/api-transactions';
import { useToast } from '../context/ToastContext.jsx';

function parseMonth(value: string | null): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map((part) => Number.parseInt(part, 10));
    const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
    const safeMonth = Number.isFinite(month) ? month - 1 : new Date().getMonth();
    return startOfMonth(new Date(safeYear, safeMonth));
  }
  return startOfMonth(new Date());
}

function parseFilter(params: URLSearchParams): CalendarFilter {
  const typeParam = params.get('type');
  const categoriesParam = params.get('categories');
  const accountsParam = params.get('accounts');
  const minParam = params.get('min');
  const maxParam = params.get('max');
  const searchParam = params.get('q') ?? '';

  const categoryIds = categoriesParam
    ? categoriesParam
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const accountIds = accountsParam
    ? accountsParam
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const parseNumber = (value: string | null) => {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return normalizeCalendarFilter({
    type: typeParam === 'all' ? 'all' : 'expense',
    categoryIds,
    accountIds,
    amountMin: parseNumber(minParam),
    amountMax: parseNumber(maxParam),
    search: searchParam,
  });
}

function buildMonthLabel(date: Date): string {
  try {
    return format(date, 'MMMM yyyy', { locale: localeId });
  } catch {
    return format(date, 'MMMM yyyy');
  }
}

function buildPercentLabel(value: number | null): string {
  if (value == null) return '—';
  const formatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 1,
    signDisplay: 'always',
  });
  return `${formatter.format(value)}% vs bulan lalu`;
}

function formatDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export default function CalendarPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const monthParam = searchParams.get('month');
  const dayParam = searchParams.get('day');
  const currentMonth = useMemo(() => parseMonth(monthParam), [monthParam]);

  const selectedDate = useMemo(() => {
    if (!dayParam) return null;
    try {
      const parsed = parseISO(dayParam);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }, [dayParam]);

  const filter = useMemo(() => parseFilter(searchParams), [searchParams]);

  const updateParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      updater(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleMonthChange = useCallback(
    (nextMonth: Date) => {
      updateParams((params) => {
        params.set('month', format(nextMonth, 'yyyy-MM'));
        const currentDay = params.get('day');
        if (currentDay) {
          const parsed = parseISO(currentDay);
          if (Number.isNaN(parsed.getTime()) || !isSameMonth(parsed, nextMonth)) {
            params.delete('day');
          }
        }
      });
    },
    [updateParams],
  );

  const handlePrevMonth = useCallback(() => {
    handleMonthChange(addMonths(currentMonth, -1));
  }, [currentMonth, handleMonthChange]);

  const handleNextMonth = useCallback(() => {
    handleMonthChange(addMonths(currentMonth, 1));
  }, [currentMonth, handleMonthChange]);

  const handleSelectDate = useCallback(
    (date: Date | undefined) => {
      updateParams((params) => {
        if (!date) {
          params.delete('day');
          return;
        }
        params.set('day', format(date, 'yyyy-MM-dd'));
        params.set('month', format(date, 'yyyy-MM'));
      });
    },
    [updateParams],
  );

  const handleToday = useCallback(() => {
    const today = new Date();
    updateParams((params) => {
      params.set('month', format(today, 'yyyy-MM'));
      params.set('day', format(today, 'yyyy-MM-dd'));
    });
  }, [updateParams]);

  const handleFilterChange = useCallback(
    (next: CalendarFilter) => {
      const normalized = normalizeCalendarFilter(next);
      updateParams((params) => {
        if (normalized.type === 'expense') {
          params.delete('type');
        } else {
          params.set('type', 'all');
        }

        if (normalized.categoryIds.length) {
          params.set('categories', normalized.categoryIds.join(','));
        } else {
          params.delete('categories');
        }

        if (normalized.accountIds.length) {
          params.set('accounts', normalized.accountIds.join(','));
        } else {
          params.delete('accounts');
        }

        if (normalized.amountMin != null) {
          params.set('min', String(normalized.amountMin));
        } else {
          params.delete('min');
        }

        if (normalized.amountMax != null) {
          params.set('max', String(normalized.amountMax));
        } else {
          params.delete('max');
        }

        const trimmedSearch = normalized.search.trim();
        if (trimmedSearch) {
          params.set('q', trimmedSearch);
        } else {
          params.delete('q');
        }
      });
    },
    [updateParams],
  );

  const handleResetFilters = useCallback(() => {
    updateParams((params) => {
      params.delete('type');
      params.delete('categories');
      params.delete('accounts');
      params.delete('min');
      params.delete('max');
      params.delete('q');
    });
  }, [updateParams]);

  const handleCloseDetail = useCallback(() => {
    updateParams((params) => {
      params.delete('day');
    });
  }, [updateParams]);

  const { data: categoryData, isLoading: categoriesLoading } = useCategories();
  const categories = categoryData ?? [];
  const categoryLookup = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((category) => {
      map[category.id] = category.name;
    });
    return map;
  }, [categories]);

  const { user, loading: userLoading } = useSupabaseUser();
  const accountsQuery = useQuery<AccountRecord[]>({
    queryKey: ['calendar', 'accounts', user?.id ?? 'anonymous'],
    queryFn: async () => {
      if (!user?.id) return [];
      return listAccounts(user.id);
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
  const accounts = accountsQuery.data ?? [];

  const monthAggregates = useMonthAggregates(currentMonth, filter);
  const dayTransactions = useDayTransactions(selectedDate, filter);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEditTransaction = useCallback(
    (transactionId: string) => {
      if (!transactionId) return;
      navigate('/transactions', {
        state: { editTransactionId: transactionId, from: '/calendar' },
      });
    },
    [navigate],
  );

  const handleViewReceipt = useCallback((transactionId: string, url: string) => {
    if (!url) return;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      addToast('Tidak dapat membuka tautan nota', 'error');
    }
  }, [addToast]);

  const handleDeleteTransaction = useCallback(
    async (transactionId: string) => {
      if (!transactionId || deletingId) return;
      const confirmed = window.confirm('Hapus transaksi ini?');
      if (!confirmed) return;
      setDeletingId(transactionId);
      try {
        await removeTransaction(transactionId);
        addToast('Transaksi dihapus', 'success');
        await Promise.all([monthAggregates.refetch(), dayTransactions.refetch()]);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Gagal menghapus transaksi.';
        addToast(message, 'error');
      } finally {
        setDeletingId(null);
      }
    },
    [addToast, dayTransactions, deletingId, monthAggregates],
  );

  const selectedAggregate = useMemo(() => {
    if (!selectedDate) return undefined;
    const key = formatDayKey(selectedDate);
    return monthAggregates.days[key];
  }, [monthAggregates.days, selectedDate]);

  const monthLabel = buildMonthLabel(currentMonth);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/70 px-3 py-1 text-xs uppercase tracking-wide text-muted">
            <CalendarDays className="h-3.5 w-3.5" /> Kalender Keuangan
          </div>
          <h1 className="text-2xl font-semibold text-text">Kalender Transaksi</h1>
          <p className="max-w-xl text-sm text-muted">
            Lihat ringkasan pengeluaran dan pemasukan per hari dengan filter dinamis. Pilih tanggal untuk melihat detail transaksi lengkap.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-900/80 text-text transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-[140px] text-center text-sm font-semibold text-text">{monthLabel}</div>
          <button
            type="button"
            onClick={handleNextMonth}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-900/80 text-text transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand/20 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            Today
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Filters
            value={filter}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
            categories={categories}
            accounts={accounts}
            loadingCategories={categoriesLoading}
            loadingAccounts={accountsQuery.isLoading || accountsQuery.isFetching || userLoading}
          />
          <CalendarGrid
            month={currentMonth}
            selectedDate={selectedDate ?? undefined}
            onSelectDate={handleSelectDate}
            onMonthChange={handleMonthChange}
            aggregates={monthAggregates.days}
            heatmap={monthAggregates.heatmap}
            isLoading={monthAggregates.isLoading || monthAggregates.isFetching}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-3xl border border-slate-800/70 bg-surface-1/80 p-5 shadow-sm backdrop-blur">
            <h2 className="text-sm font-semibold text-muted">Ringkasan Bulan Ini</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-rose-200/70">Pengeluaran MTD</p>
                <p className="mt-1 text-lg font-semibold text-rose-200">{formatCurrency(monthAggregates.summary.expense)}</p>
                <p className="text-[11px] text-rose-200/70">{buildPercentLabel(monthAggregates.summary.expenseMoM)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-emerald-200/70">Pemasukan MTD</p>
                <p className="mt-1 text-lg font-semibold text-emerald-200">{formatCurrency(monthAggregates.summary.income)}</p>
                <p className="text-[11px] text-emerald-200/70">{buildPercentLabel(monthAggregates.summary.incomeMoM)}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-300/70">Net MTD</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {monthAggregates.summary.net >= 0
                    ? `+${formatCurrency(monthAggregates.summary.net)}`
                    : `-${formatCurrency(Math.abs(monthAggregates.summary.net))}`}
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-3xl border border-slate-800/70 bg-surface-1/70 p-5 text-sm text-muted shadow-sm backdrop-blur">
            <p className="font-semibold text-text">Tips</p>
            <ul className="mt-3 list-disc space-y-1 pl-4">
              <li>Gunakan filter kategori dan akun untuk melihat pola tertentu.</li>
              <li>Klik tanggal untuk melihat detail transaksi dan aksi cepat.</li>
              <li>Warna sel menandakan intensitas pengeluaran harian.</li>
            </ul>
          </section>
        </aside>
      </div>

      <DayDetailModal
        open={Boolean(selectedDate)}
        onClose={handleCloseDetail}
        date={selectedDate}
        aggregate={selectedAggregate}
        transactions={dayTransactions.transactions}
        categoryLookup={categoryLookup}
        isLoading={dayTransactions.isLoading || dayTransactions.isFetching}
        onEdit={handleEditTransaction}
        onViewReceipt={handleViewReceipt}
        onDelete={handleDeleteTransaction}
        deletingId={deletingId}
      />
    </main>
  );
}
