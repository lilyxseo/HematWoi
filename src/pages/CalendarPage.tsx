import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../layout/PageHeader.jsx';
import Filters from '../components/calendar/Filters';
import { DayCell } from '../components/calendar/DayCell';
import DetailModal from '../components/calendar/DetailModal';
import { useMonthAggregates } from '../hooks/useMonthAggregates';
import type { CalendarFilters as CalendarFilterState } from '../lib/calendarApi';
import { supabase } from '../lib/supabase';
import { fetchCategoriesSafe } from '../services/categories';

interface CategoryOption {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface AccountOption {
  id: string;
  name: string;
}

const DEFAULT_FILTERS: CalendarFilterState = {
  type: 'expense',
  categories: [],
  accountIds: [],
};

function parseMonthParam(value: string | null): Date {
  if (!value) {
    return startOfMonth(new Date());
  }
  const [yearStr, monthStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return startOfMonth(new Date());
  }
  return startOfMonth(new Date(year, month, 1));
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  } catch (error) {
    console.error('[calendar:parseDate] Failed', error);
    return null;
  }
}

function parseNumberParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function serializeFilters(filters: CalendarFilterState): Record<string, string> {
  const result: Record<string, string> = {};
  if (filters.type !== 'expense') {
    result.type = filters.type;
  }
  if (filters.categories.length) {
    result.categories = filters.categories.join(',');
  }
  if (filters.accountIds.length) {
    result.accounts = filters.accountIds.join(',');
  }
  if (filters.minAmount != null) {
    result.min = String(filters.minAmount);
  }
  if (filters.maxAmount != null) {
    result.max = String(filters.maxAmount);
  }
  if (filters.search) {
    result.q = filters.search;
  }
  return result;
}

function useFilterState(searchParams: URLSearchParams): CalendarFilterState {
  const typeParam = searchParams.get('type');
  const categoriesParam = searchParams.get('categories');
  const accountsParam = searchParams.get('accounts');
  const minParam = searchParams.get('min');
  const maxParam = searchParams.get('max');
  const searchParam = searchParams.get('q') ?? undefined;

  return {
    type: typeParam === 'all' ? 'all' : 'expense',
    categories: categoriesParam ? categoriesParam.split(',').filter(Boolean) : [],
    accountIds: accountsParam ? accountsParam.split(',').filter(Boolean) : [],
    minAmount: parseNumberParam(minParam),
    maxAmount: parseNumberParam(maxParam),
    search: searchParam,
  } satisfies CalendarFilterState;
}

function useCategoriesOptions() {
  return useQuery({
    queryKey: ['calendar', 'categories'],
    queryFn: async () => {
      const rows = await fetchCategoriesSafe({ types: ['expense', 'income'] });
      return rows.map((item) => ({ id: item.id, name: item.name, type: item.type })) as CategoryOption[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

function useAccountsOptions() {
  return useQuery({
    queryKey: ['calendar', 'accounts'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error('[calendar:accounts] Failed to get user', error);
          return [] as AccountOption[];
        }
        const userId = data?.user?.id;
        let query = supabase.from('accounts').select('id,name').order('name', { ascending: true });
        if (userId) {
          query = query.eq('user_id', userId);
        }
        const { data: rows, error: queryError } = await query;
        if (queryError) {
          console.error('[calendar:accounts] Query failed', queryError);
          return [] as AccountOption[];
        }
        return (rows ?? []) as AccountOption[];
      } catch (error) {
        console.error('[calendar:accounts] Unexpected error', error);
        return [] as AccountOption[];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

function getWeekDays(): string[] {
  const base = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: 7 }).map((_, index) => format(addDays(base, index), 'EEE'));
}

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthFromParams = parseMonthParam(searchParams.get('month'));
  const [currentMonth, setCurrentMonth] = useState<Date>(monthFromParams);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => parseDateParam(searchParams.get('date')));
  const [detailOpen, setDetailOpen] = useState(false);
  const [focusDate, setFocusDate] = useState<Date>(() => selectedDate ?? new Date());

  const filters = useFilterState(searchParams);
  const showIncome = filters.type === 'all';

  const categoriesQuery = useCategoriesOptions();
  const accountsQuery = useAccountsOptions();

  const { data: monthData, heatmap, isLoading, refetch } = useMonthAggregates({
    month: currentMonth,
    filters: { ...DEFAULT_FILTERS, ...filters },
  });

  const categoriesMap = useMemo(() => {
    const map = new Map<string, CategoryOption>();
    (categoriesQuery.data ?? []).forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [categoriesQuery.data]);

  useEffect(() => {
    const targetMonth = parseMonthParam(searchParams.get('month'));
    if (targetMonth.getTime() !== currentMonth.getTime()) {
      setCurrentMonth(targetMonth);
    }
  }, [searchParams, currentMonth]);

  useEffect(() => {
    const paramDate = parseDateParam(searchParams.get('date'));
    if (
      (paramDate && (!selectedDate || paramDate.getTime() !== selectedDate.getTime())) ||
      (!paramDate && selectedDate)
    ) {
      setSelectedDate(paramDate);
      if (paramDate) {
        setFocusDate(paramDate);
      }
    }
  }, [searchParams, selectedDate]);

  const updateSearchParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleMonthChange = (delta: number) => {
    const nextMonth = startOfMonth(addMonths(currentMonth, delta));
    setCurrentMonth(nextMonth);
    updateSearchParams({ month: format(nextMonth, 'yyyy-MM') });
  };

  const handleToday = () => {
    const today = new Date();
    const month = startOfMonth(today);
    setCurrentMonth(month);
    setFocusDate(today);
    setSelectedDate(today);
    setDetailOpen(true);
    updateSearchParams({ month: format(month, 'yyyy-MM'), date: format(today, 'yyyy-MM-dd') });
  };

  const handleSelectDate = (date: Date, openDetail = true) => {
    setSelectedDate(date);
    setFocusDate(date);
    if (openDetail) {
      setDetailOpen(true);
    }
    updateSearchParams({ date: format(date, 'yyyy-MM-dd'), month: format(startOfMonth(date), 'yyyy-MM') });
    if (!isSameMonth(date, currentMonth)) {
      setCurrentMonth(startOfMonth(date));
    }
  };

  const handleFiltersChange = (nextFilters: CalendarFilterState) => {
    const payload = serializeFilters(nextFilters);
    updateSearchParams({
      type: payload.type,
      categories: payload.categories,
      accounts: payload.accounts,
      min: payload.min,
      max: payload.max,
      q: payload.q,
    });
  };

  const handleResetFilters = () => {
    updateSearchParams({ type: undefined, categories: undefined, accounts: undefined, min: undefined, max: undefined, q: undefined });
  };

  const weekdays = useMemo(() => getWeekDays(), []);
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [currentMonth]);

  const expenseMoM = useMemo(() => {
    if (!monthData) return null;
    if (!monthData.expensePrevMonth) {
      return monthData.expenseTotal > 0 ? Infinity : null;
    }
    return ((monthData.expenseTotal - monthData.expensePrevMonth) / monthData.expensePrevMonth) * 100;
  }, [monthData]);

  const incomeMoM = useMemo(() => {
    if (!monthData) return null;
    if (!monthData.incomePrevMonth) {
      return monthData.incomeTotal > 0 ? Infinity : null;
    }
    return ((monthData.incomeTotal - monthData.incomePrevMonth) / monthData.incomePrevMonth) * 100;
  }, [monthData]);

  const handleGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!focusDate) return;
    let nextDate: Date | null = null;
    if (event.key === 'ArrowLeft') {
      nextDate = addDays(focusDate, -1);
    } else if (event.key === 'ArrowRight') {
      nextDate = addDays(focusDate, 1);
    } else if (event.key === 'ArrowUp') {
      nextDate = addDays(focusDate, -7);
    } else if (event.key === 'ArrowDown') {
      nextDate = addDays(focusDate, 7);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      setSelectedDate(focusDate);
      setDetailOpen(true);
      updateSearchParams({
        date: format(focusDate, 'yyyy-MM-dd'),
        month: format(startOfMonth(focusDate), 'yyyy-MM'),
      });
      return;
    }

    if (nextDate) {
      event.preventDefault();
      setFocusDate(nextDate);
      setSelectedDate(nextDate);
      updateSearchParams({ date: format(nextDate, 'yyyy-MM-dd'), month: format(startOfMonth(nextDate), 'yyyy-MM') });
      if (!isSameMonth(nextDate, currentMonth)) {
        setCurrentMonth(startOfMonth(nextDate));
      }
    }
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
  };

  const monthLabel = format(currentMonth, 'MMMM yyyy');
  const transactionsByDate = monthData?.days ?? {};

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 sm:px-6 lg:px-8">
      <PageHeader title="Kalender" description="Pantau ringkasan pengeluaran dan pemasukan harian dalam satu tampilan." />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleMonthChange(-1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-lg text-white transition hover:border-[color:var(--accent,theme(colors.rose.400))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
                aria-label="Bulan sebelumnya"
              >
                ◀︎
              </button>
              <h2 className="text-lg font-semibold text-white">{monthLabel}</h2>
              <button
                type="button"
                onClick={() => handleMonthChange(1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-lg text-white transition hover:border-[color:var(--accent,theme(colors.rose.400))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
                aria-label="Bulan berikutnya"
              >
                ▶︎
              </button>
            </div>
            <button
              type="button"
              onClick={handleToday}
              className="inline-flex items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-white transition hover:border-[color:var(--accent,theme(colors.rose.400))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.rose.500))]"
            >
              Hari ini
            </button>
          </div>

          <Filters
            filters={{ ...DEFAULT_FILTERS, ...filters }}
            onChange={handleFiltersChange}
            onReset={handleResetFilters}
            categories={categoriesQuery.data ?? []}
            accounts={accountsQuery.data ?? []}
            loading={categoriesQuery.isLoading || accountsQuery.isLoading}
          />

          <div
            className="rounded-3xl border border-border/60 bg-surface-1/60 p-4 backdrop-blur"
            role="application"
            tabIndex={0}
            onKeyDown={handleGridKeyDown}
          >
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase text-muted">
              {weekdays.map((weekday) => (
                <div key={weekday}>{weekday}</div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-7 gap-2 md:gap-3">
              {isLoading ? (
                Array.from({ length: 35 }).map((_, index) => (
                  <div key={index} className="h-24 rounded-xl bg-surface-2/60 animate-pulse" />
                ))
              ) : (
                calendarDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const aggregate = transactionsByDate[key];
                  const heat = heatmap[key]?.level ?? 0;
                  const isCurrent = isSameMonth(day, currentMonth);
                  const selected = selectedDate ? format(selectedDate, 'yyyy-MM-dd') === key : false;
                  return (
                    <DayCell
                      key={key}
                      date={day}
                      aggregate={aggregate}
                      isCurrentMonth={isCurrent}
                      isSelected={selected}
                      isToday={isToday(day)}
                      showIncome={showIncome}
                      heatLevel={heat}
                      onSelect={(value) => handleSelectDate(value, true)}
                      onOpenDetail={() => setDetailOpen(true)}
                    />
                  );
                })
              )}
            </div>
            {!isLoading && Object.keys(transactionsByDate).length === 0 ? (
              <p className="mt-6 text-center text-sm text-muted">Tidak ada transaksi pada bulan ini.</p>
            ) : null}
          </div>
        </div>

        <aside className="w-full max-w-sm space-y-4 rounded-3xl border border-border/60 bg-surface-1/80 p-6 backdrop-blur">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Ringkasan bulan ini</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted">Total Pengeluaran</p>
              <p className="text-xl font-semibold text-rose-400">
                Rp{(monthData?.expenseTotal ?? 0).toLocaleString('id-ID')}
              </p>
              {expenseMoM != null ? (
                <p className="text-xs text-muted">
                  MoM: {expenseMoM === Infinity ? '—' : `${expenseMoM.toFixed(1)}%`}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted">Total Pemasukan</p>
              <p className="text-xl font-semibold text-emerald-400">
                Rp{(monthData?.incomeTotal ?? 0).toLocaleString('id-ID')}
              </p>
              {incomeMoM != null ? (
                <p className="text-xs text-muted">
                  MoM: {incomeMoM === Infinity ? '—' : `${incomeMoM.toFixed(1)}%`}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted">Netto</p>
              <p className="text-xl font-semibold text-white">
                Rp{(monthData?.netTotal ?? 0).toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <DetailModal
        open={detailOpen && Boolean(selectedDate)}
        date={selectedDate}
        filters={{ ...DEFAULT_FILTERS, ...filters }}
        onClose={handleCloseDetail}
        categories={categoriesMap}
        showIncome={showIncome}
        onDataChange={refetch}
      />
    </main>
  );
}
