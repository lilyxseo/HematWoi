import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DayPicker, type DayContentProps } from 'react-day-picker';
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  parse,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import clsx from 'clsx';
import { CalendarDays, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import CalendarFilters from '../components/calendar/Filters';
import DayCell, { DayHeatLevel } from '../components/calendar/DayCell';
import DayDetailDialog from '../components/calendar/DayDetailDialog';
import useMonthAggregates from '../hooks/useMonthAggregates';
import useDayTransactions from '../hooks/useDayTransactions';
import useSupabaseUser from '../hooks/useSupabaseUser';
import useCategories from '../hooks/useCategories';
import { listAccounts } from '../lib/api';
import { CalendarFilters as CalendarFilterValue, normalizeFiltersInput } from '../lib/calendarApi';
import { formatCurrency } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { deleteTransaction } from '../lib/api';

import 'react-day-picker/dist/style.css';

function formatMonthParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = parse(value, 'yyyy-MM', new Date());
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return startOfMonth(parsed);
}

function formatDayParam(value: string | null): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  } catch {
    const fallback = parse(value, 'yyyy-MM-dd', new Date());
    if (Number.isNaN(fallback.getTime())) return null;
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
}

function formatMoM(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  const formatted = `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  return formatted;
}

function getHeatLevel(expense: number, stats?: { p80: number; maxExpense: number }): DayHeatLevel {
  if (!stats) return 'none';
  if (!Number.isFinite(expense) || expense <= 0) {
    return 'none';
  }
  const base = stats.p80 > 0 ? stats.p80 : stats.maxExpense > 0 ? stats.maxExpense : expense;
  if (base <= 0) {
    return 'full';
  }
  const ratio = expense / base;
  if (ratio <= 0.25) return 'quarter';
  if (ratio <= 0.5) return 'half';
  if (ratio <= 0.75) return 'three-quarter';
  if (ratio <= 1) return 'full';
  return 'overflow';
}

function toDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

const CALENDAR_CLASSNAMES = {
  root: 'rdp text-slate-200',
  months: 'flex flex-col gap-4',
  month: 'space-y-4',
  caption: 'sr-only',
  table: 'w-full border-collapse',
  tbody: 'grid grid-cols-7 gap-2 md:gap-3',
  head_row: 'grid grid-cols-7 gap-2 md:gap-3 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400',
  head_cell: 'text-left',
  row: 'contents',
  cell: 'p-0',
  day: 'h-full w-full rounded-xl p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
  day_selected: 'focus-visible:ring-0',
  day_today: '',
  day_disabled: 'opacity-40',
  day_outside: 'opacity-40',
};

function buildSkeleton(): JSX.Element {
  return (
    <div className="grid grid-cols-7 gap-2 md:gap-3">
      {Array.from({ length: 35 }).map((_, index) => (
        <div key={index} className="h-[92px] rounded-xl bg-slate-900/60" />
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useSupabaseUser();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMonth = useMemo(() => formatMonthParam(searchParams.get('month')) ?? startOfMonth(new Date()), [searchParams]);
  const [currentMonth, setCurrentMonth] = useState<Date>(initialMonth);

  const initialDay = useMemo(() => formatDayParam(searchParams.get('day')), [searchParams]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDay);
  const [detailOpen, setDetailOpen] = useState<boolean>(Boolean(initialDay));
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const paramMonth = formatMonthParam(searchParams.get('month'));
    if (paramMonth && !isSameMonth(paramMonth, currentMonth)) {
      setCurrentMonth(paramMonth);
    }
  }, [searchParams, currentMonth]);

  useEffect(() => {
    const paramDay = formatDayParam(searchParams.get('day'));
    if (paramDay) {
      setSelectedDate((prev) => (prev && isSameDay(prev, paramDay) ? prev : paramDay));
      setDetailOpen(true);
    } else if (!paramDay) {
      setDetailOpen(false);
    }
  }, [searchParams]);

  const rawFilters = useMemo(() => {
    const includeIncome = searchParams.get('mode') === 'all';
    const categoriesParam = searchParams.get('categories');
    const accountsParam = searchParams.get('accounts');
    const minParam = searchParams.get('min');
    const maxParam = searchParams.get('max');
    const searchParam = searchParams.get('q');

    const categoryIds = categoriesParam ? categoriesParam.split(',').filter(Boolean) : [];
    const accountIds = accountsParam ? accountsParam.split(',').filter(Boolean) : [];
    const minAmount = minParam ? Number.parseFloat(minParam) : null;
    const maxAmount = maxParam ? Number.parseFloat(maxParam) : null;

    return normalizeFiltersInput({
      includeIncome,
      categoryIds,
      accountIds,
      minAmount,
      maxAmount,
      search: searchParam ?? '',
    });
  }, [searchParams]);

  const filters = rawFilters;

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories(['expense', 'income']);

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['calendar-accounts', user?.id ?? 'anonymous'],
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    queryFn: () => (user?.id ? listAccounts(user.id) : Promise.resolve([])),
  });

  const monthQuery = useMonthAggregates({ userId: user?.id ?? null, month: currentMonth, filters });

  const dayQuery = useDayTransactions({
    userId: user?.id ?? null,
    date: selectedDate,
    filters,
    enabled: detailOpen && Boolean(selectedDate),
  });

  const categoryOptions = useMemo(
    () =>
      (categoriesData ?? []).map((category: any) => ({
        id: category.id,
        name: category.name ?? 'Tanpa nama',
        color: category.color ?? null,
      })),
    [categoriesData],
  );

  const accountOptions = useMemo(
    () =>
      (accountsData ?? []).map((account: any) => ({
        id: account.id,
        name: account.name ?? 'Akun tanpa nama',
      })),
    [accountsData],
  );

  const monthLabel = useMemo(() => format(currentMonth, 'MMMM yyyy', { locale: localeId }), [currentMonth]);

  const updateSearchParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      updater(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleMonthChange = useCallback(
    (nextMonth: Date) => {
      const normalized = startOfMonth(nextMonth);
      setCurrentMonth(normalized);
      updateSearchParams((params) => {
        params.set('month', format(normalized, 'yyyy-MM'));
      });
    },
    [updateSearchParams],
  );

  const handlePrevMonth = useCallback(() => {
    handleMonthChange(subMonths(currentMonth, 1));
  }, [currentMonth, handleMonthChange]);

  const handleNextMonth = useCallback(() => {
    handleMonthChange(addMonths(currentMonth, 1));
  }, [currentMonth, handleMonthChange]);

  const handleSelectDate = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      if (!isSameMonth(normalized, currentMonth)) {
        handleMonthChange(startOfMonth(normalized));
      }
      setSelectedDate(normalized);
      setDetailOpen(true);
      updateSearchParams((params) => {
        params.set('day', format(normalized, 'yyyy-MM-dd'));
        params.set('month', format(startOfMonth(normalized), 'yyyy-MM'));
      });
    },
    [currentMonth, handleMonthChange, updateSearchParams],
  );

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    updateSearchParams((params) => {
      params.delete('day');
    });
  }, [updateSearchParams]);

  const handleToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    handleMonthChange(startOfMonth(today));
    setSelectedDate(today);
    setDetailOpen(true);
    updateSearchParams((params) => {
      params.set('month', format(startOfMonth(today), 'yyyy-MM'));
      params.set('day', format(today, 'yyyy-MM-dd'));
    });
  }, [handleMonthChange, updateSearchParams]);

  const handleFiltersChange = useCallback(
    (partial: Partial<CalendarFilterValue>) => {
      const nextFilters = normalizeFiltersInput({ ...filters, ...partial });
      updateSearchParams((params) => {
        params.set('mode', nextFilters.includeIncome ? 'all' : 'expense');
        if (nextFilters.categoryIds.length) {
          params.set('categories', nextFilters.categoryIds.join(','));
        } else {
          params.delete('categories');
        }
        if (nextFilters.accountIds.length) {
          params.set('accounts', nextFilters.accountIds.join(','));
        } else {
          params.delete('accounts');
        }
        if (nextFilters.minAmount !== null) {
          params.set('min', String(nextFilters.minAmount));
        } else {
          params.delete('min');
        }
        if (nextFilters.maxAmount !== null) {
          params.set('max', String(nextFilters.maxAmount));
        } else {
          params.delete('max');
        }
        if (nextFilters.search) {
          params.set('q', nextFilters.search);
        } else {
          params.delete('q');
        }
      });
    },
    [filters, updateSearchParams],
  );

  const handleResetFilters = useCallback(() => {
    updateSearchParams((params) => {
      params.delete('mode');
      params.delete('categories');
      params.delete('accounts');
      params.delete('min');
      params.delete('max');
      params.delete('q');
    });
  }, [updateSearchParams]);

  const handleViewReceipt = useCallback((url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }, []);

  const handleEditTransaction = useCallback(
    (id: string) => {
      if (!id) return;
      const params = new URLSearchParams();
      if (selectedDate) {
        params.set('focusDate', format(selectedDate, 'yyyy-MM-dd'));
      }
      params.set('highlight', id);
      navigate(`/transactions?${params.toString()}`);
    },
    [navigate, selectedDate],
  );

  const handleDeleteTransaction = useCallback(
    async (id: string) => {
      if (!id) return;
      const confirmed = window.confirm('Hapus transaksi ini?');
      if (!confirmed) return;
      try {
        setDeletingId(id);
        await deleteTransaction(id);
        addToast('Transaksi dihapus', 'success');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['calendar-month', user?.id ?? 'anonymous'] }),
          queryClient.invalidateQueries({ queryKey: ['calendar-day', user?.id ?? 'anonymous'] }),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal menghapus transaksi';
        addToast(message, 'error');
      } finally {
        setDeletingId(null);
      }
    },
    [addToast, queryClient, user?.id],
  );

  const dayContent = useCallback(
    (props: DayContentProps) => {
      const { date, activeModifiers } = props;
      const key = toDayKey(date);
      const totals = monthQuery.data?.days?.[key] ?? null;
      const heatLevel = getHeatLevel(totals?.expenseTotal ?? 0, monthQuery.data?.stats);
      return (
        <DayCell
          date={date}
          totals={totals}
          heatLevel={heatLevel}
          showIncome={filters.includeIncome}
          isOutsideMonth={Boolean(activeModifiers.outside)}
          isSelected={Boolean(activeModifiers.selected)}
          isToday={Boolean(activeModifiers.today)}
        />
      );
    },
    [filters.includeIncome, monthQuery.data?.days, monthQuery.data?.stats],
  );

  const summary = monthQuery.data;
  const totalsExpense = summary?.totals.expense ?? 0;
  const totalsIncome = summary?.totals.income ?? 0;
  const totalsNet = summary?.totals.net ?? 0;

  const calendarContent = monthQuery.isLoading ? (
    <div className="mt-4">{buildSkeleton()}</div>
  ) : monthQuery.error ? (
    <div className="mt-4 rounded-2xl border border-rose-700/60 bg-rose-950/40 p-4 text-sm text-rose-300">
      {(monthQuery.error as Error).message || 'Gagal memuat kalender.'}
    </div>
  ) : (
    <DayPicker
      locale={localeId}
      mode="single"
      month={currentMonth}
      selected={selectedDate ?? undefined}
      onSelect={handleSelectDate}
      onMonthChange={handleMonthChange}
      showOutsideDays
      weekStartsOn={1}
      hideNavigation
      classNames={CALENDAR_CLASSNAMES}
      components={{ DayContent: dayContent }}
    />
  );

  const dayTransactions = dayQuery.data?.transactions ?? [];
  const dayTotals = dayQuery.data?.totals ?? { expense: 0, income: 0 };

  return (
    <Page className="text-slate-100">
      <PageHeader
        title="Kalender Keuangan"
        description="Pantau pengeluaran dan pemasukan harian dalam satu tampilan."
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex-1">
          <CalendarFilters
            value={{
              includeIncome: filters.includeIncome,
              categoryIds: filters.categoryIds,
              accountIds: filters.accountIds,
              minAmount: filters.minAmount,
              maxAmount: filters.maxAmount,
              search: filters.search,
            }}
            onChange={handleFiltersChange}
            onReset={handleResetFilters}
            categories={categoryOptions}
            accounts={accountOptions}
            loadingCategories={categoriesLoading}
            loadingAccounts={accountsLoading}
          />
        </div>
        <div className="min-w-[240px] rounded-3xl bg-slate-950/70 p-4 ring-1 ring-slate-800">
          <div className="flex items-center gap-2 text-slate-400">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide">Ringkasan Bulan</span>
          </div>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Pengeluaran</p>
              <p className="text-lg font-semibold text-rose-400">{formatCurrency(totalsExpense, 'IDR')}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                {summary?.mom.expense !== null ? (
                  summary.mom.expense >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-rose-400" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                  )
                ) : null}
                <span>MoM: {formatMoM(summary?.mom.expense ?? null)}</span>
              </p>
            </div>
            {filters.includeIncome && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Total Pemasukan</p>
                <p className="text-lg font-semibold text-emerald-400">{formatCurrency(totalsIncome, 'IDR')}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                  {summary?.mom.income !== null ? (
                    summary.mom.income >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-rose-400" aria-hidden="true" />
                    )
                  ) : null}
                  <span>MoM: {formatMoM(summary?.mom.income ?? null)}</span>
                </p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Netto</p>
              <p className={clsx('text-lg font-semibold', totalsNet >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {`${totalsNet >= 0 ? '+' : '-'} ${formatCurrency(Math.abs(totalsNet), 'IDR')}`}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                {summary?.mom.net !== null ? (
                  summary.mom.net >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-rose-400" aria-hidden="true" />
                  )
                ) : null}
                <span>MoM: {formatMoM(summary?.mom.net ?? null)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-3xl bg-slate-950/70 p-4 ring-1 ring-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-full border border-slate-700 p-2 text-slate-200 transition hover:border-slate-500 hover:text-white"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <h2 className="text-lg font-semibold text-slate-100">{monthLabel}</h2>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-full border border-slate-700 p-2 text-slate-200 transition hover:border-slate-500 hover:text-white"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Hari ini
            </button>
          </div>
        </div>
        <div className="mt-4">
          {calendarContent}
        </div>
      </section>

      <DayDetailDialog
        open={detailOpen && Boolean(selectedDate)}
        onClose={handleCloseDetail}
        date={selectedDate}
        loading={dayQuery.isLoading}
        error={dayQuery.error instanceof Error ? dayQuery.error.message : null}
        transactions={dayTransactions}
        totals={dayTotals}
        showIncome={filters.includeIncome}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
        onViewReceipt={handleViewReceipt}
        deletingId={deletingId}
      />
    </Page>
  );
}
