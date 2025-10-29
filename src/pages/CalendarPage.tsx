import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import CalendarGrid from '../components/calendar/CalendarGrid';
import Filters, { type CalendarFilterState } from '../components/calendar/Filters';
import DayDetailModal from '../components/calendar/DayDetailModal';
import useMonthAggregates from '../hooks/useMonthAggregates';
import useDayTransactions from '../hooks/useDayTransactions';
import { listCategories } from '../lib/api-categories';
import { listAccounts } from '../lib/api';
import { getCurrentUserId } from '../lib/session';
import {
  fetchMerchants,
  type MerchantRecord,
} from '../lib/calendarApi';
import { useToast } from '../context/ToastContext';
import type { CategoryRecord } from '../lib/api-categories';
import type { AccountRecord } from '../lib/api';
import { formatCurrency } from '../lib/format';

const DEFAULT_FILTERS: CalendarFilterState = {
  mode: 'expense',
  categoryIds: [],
  accountIds: [],
  minAmount: null,
  maxAmount: null,
  search: '',
};

function parseMonth(value: string | null): Date {
  if (!value) return startOfMonth(new Date());
  const parsed = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return startOfMonth(new Date());
  }
  return startOfMonth(parsed);
}

function parseNumberParam(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFilters(params: URLSearchParams): CalendarFilterState {
  const modeParam = params.get('type');
  const categoriesParam = params.get('categories') || '';
  const accountsParam = params.get('accounts') || '';
  const minParam = params.get('min');
  const maxParam = params.get('max');
  const searchParam = params.get('q') || '';

  return {
    mode: modeParam === 'all' ? 'all' : 'expense',
    categoryIds: categoriesParam ? categoriesParam.split(',').filter(Boolean) : [],
    accountIds: accountsParam ? accountsParam.split(',').filter(Boolean) : [],
    minAmount: parseNumberParam(minParam),
    maxAmount: parseNumberParam(maxParam),
    search: searchParam,
  };
}

function formatMonthLabel(month: Date) {
  return format(month, 'LLLL yyyy', { locale: localeId });
}

function buildSearchParams(
  month: Date,
  filters: CalendarFilterState,
  selectedDate: string | null,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('month', format(month, 'yyyy-MM'));
  params.set('type', filters.mode);
  if (filters.categoryIds.length) {
    params.set('categories', filters.categoryIds.join(','));
  }
  if (filters.accountIds.length) {
    params.set('accounts', filters.accountIds.join(','));
  }
  if (filters.minAmount !== null && filters.minAmount !== undefined) {
    params.set('min', String(filters.minAmount));
  }
  if (filters.maxAmount !== null && filters.maxAmount !== undefined) {
    params.set('max', String(filters.maxAmount));
  }
  if (filters.search.trim()) {
    params.set('q', filters.search.trim());
  }
  if (selectedDate) {
    params.set('date', selectedDate);
  }
  return params;
}

function mapCategories(records: CategoryRecord[] | undefined) {
  if (!records) return { options: [], map: new Map<string, { name: string; color?: string | null }>() };
  const options = records.map((record) => ({ id: record.id, name: record.name, type: record.type }));
  const map = new Map<string, { name: string; color?: string | null }>();
  records.forEach((record) => {
    map.set(record.id, { name: record.name, color: record.color });
  });
  return { options, map };
}

function mapAccounts(records: AccountRecord[] | undefined) {
  if (!records) return { options: [], map: new Map<string, string>() };
  const options = records.map((record) => ({ id: record.id, name: record.name }));
  const map = new Map<string, string>();
  records.forEach((record) => {
    map.set(record.id, record.name);
  });
  return { options, map };
}

function mapMerchants(records: MerchantRecord[] | undefined) {
  if (!records) return new Map<string, string>();
  const map = new Map<string, string>();
  records.forEach((record) => {
    if (record.id) {
      map.set(record.id, record.name || '');
    }
  });
  return map;
}

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [month, setMonth] = useState(() => parseMonth(searchParams.get('month')));
  const [filters, setFilters] = useState<CalendarFilterState>(() => parseFilters(searchParams));
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const dateParam = searchParams.get('date');
    return dateParam || null;
  });

  const searchParamsString = searchParams.toString();

  useEffect(() => {
    const params = buildSearchParams(month, filters, selectedDate);
    const nextString = params.toString();
    if (nextString !== searchParamsString) {
      setSearchParams(params, { replace: true });
    }
  }, [month, filters, selectedDate, searchParamsString, setSearchParams]);

  const handlePrevMonth = useCallback(() => {
    setMonth((current) => subMonths(current, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setMonth((current) => addMonths(current, 1));
  }, []);

  const handleToday = useCallback(() => {
    const today = startOfMonth(new Date());
    setMonth(today);
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    setSelectedDate(todayKey);
  }, []);

  const { data: categoriesData } = useQuery({
    queryKey: ['calendar', 'categories'],
    queryFn: ({ signal }) => listCategories(signal),
    staleTime: 5 * 60 * 1000,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['calendar', 'accounts'],
    queryFn: async () => {
      try {
        const userId = await getCurrentUserId();
        if (!userId) return [] as AccountRecord[];
        return await listAccounts(userId);
      } catch {
        return [] as AccountRecord[];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: merchantsData } = useQuery({
    queryKey: ['calendar', 'merchants'],
    queryFn: ({ signal }) => fetchMerchants(signal),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { options: categoryOptions, map: categoryMap } = useMemo(
    () => mapCategories(categoriesData),
    [categoriesData],
  );

  const { options: accountOptions, map: accountMap } = useMemo(
    () => mapAccounts(accountsData),
    [accountsData],
  );

  const merchantMap = useMemo(() => mapMerchants(merchantsData), [merchantsData]);

  const aggregates = useMonthAggregates(month, filters, merchantMap);

  const dayTransactions = useDayTransactions(selectedDate, filters, merchantMap);

  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);

  useEffect(() => {
    if (!selectedDate) return;
    const selected = new Date(selectedDate);
    if (Number.isNaN(selected.getTime())) {
      setSelectedDate(null);
      return;
    }
    if (selected.getFullYear() !== month.getFullYear() || selected.getMonth() !== month.getMonth()) {
      setSelectedDate(null);
    }
  }, [month, selectedDate]);

  const handleSelectDate = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  const handleFilterChange = useCallback((next: CalendarFilterState) => {
    setFilters(next);
  }, []);

  const handleEditTransaction = useCallback(
    (id: string) => {
      navigate('/transactions', {
        state: { editTransactionId: id },
      });
    },
    [navigate],
  );

  const handleViewReceipt = useCallback((url: string) => {
    try {
      window.open(url, '_blank', 'noopener');
    } catch {
      /* ignore */
    }
  }, []);

  const handleDeleteTransaction = useCallback(
    async (id: string) => {
      try {
        const success = await dayTransactions.deleteTransaction(id);
        if (success) {
          addToast('Transaksi dihapus.', 'success');
        }
        return success;
      } catch (error) {
        addToast(
          (error as { message?: string })?.message || 'Gagal menghapus transaksi.',
          'error',
        );
        return false;
      }
    },
    [dayTransactions, addToast],
  );

  const netChangeLabel = useMemo(() => {
    const value = aggregates.summary.netChangePct;
    if (value == null || Number.isNaN(value)) return '—';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  }, [aggregates.summary.netChangePct]);

  return (
    <Page>
      <PageHeader
        title="Kalender"
        description="Pantau pola pengeluaran dan pemasukan harian"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="inline-flex items-center rounded-full border border-border/60 bg-surface-1 px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-2"
            >
              Today
            </button>
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-surface-1/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface-1 text-sm font-semibold text-text transition hover:bg-surface-2"
                aria-label="Bulan sebelumnya"
              >
                ‹
              </button>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-text">{monthLabel}</h2>
                <p className="text-xs text-muted">
                  Net MoM: {netChangeLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-surface-1 text-sm font-semibold text-text transition hover:bg-surface-2"
                aria-label="Bulan selanjutnya"
              >
                ›
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="rounded-2xl border border-border/60 bg-surface-2/70 px-3 py-2">
                <p className="text-muted">Expense MTD</p>
                <p className="mt-1 font-semibold text-rose-400">
                  {`- ${formatCurrency(aggregates.summary.totalExpense)}`}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-surface-2/70 px-3 py-2">
                <p className="text-muted">Income MTD</p>
                <p className="mt-1 font-semibold text-emerald-400">
                  {`+ ${formatCurrency(aggregates.summary.totalIncome)}`}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-surface-2/70 px-3 py-2">
                <p className="text-muted">Net</p>
                <p
                  className={clsx(
                    'mt-1 font-semibold',
                    aggregates.summary.net >= 0 ? 'text-emerald-400' : 'text-rose-400',
                  )}
                >
                  {`${aggregates.summary.net >= 0 ? '+' : '-'} ${formatCurrency(
                    Math.abs(aggregates.summary.net),
                  )}`}
                </p>
              </div>
            </div>
          </div>

          <CalendarGrid
            month={month}
            days={aggregates.days}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            getHeatmapClass={aggregates.getHeatmapClass}
            showIncome={filters.mode === 'all'}
            loading={aggregates.isLoading || aggregates.isFetching}
          />
        </div>

        <Filters
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          categories={categoryOptions}
          accounts={accountOptions}
        />
      </div>

      <DayDetailModal
        open={Boolean(selectedDate)}
        date={selectedDate}
        totals={dayTransactions.totals}
        transactions={dayTransactions.transactions}
        loading={dayTransactions.isLoading || dayTransactions.isFetching}
        error={dayTransactions.error}
        deletingId={dayTransactions.deletingId}
        onClose={() => setSelectedDate(null)}
        onEdit={handleEditTransaction}
        onViewReceipt={handleViewReceipt}
        onDelete={handleDeleteTransaction}
        showIncome={filters.mode === 'all'}
        categoryLookup={categoryMap}
        accountLookup={accountMap}
        merchantLookup={merchantMap}
      />
    </Page>
  );
}
