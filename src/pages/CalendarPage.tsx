import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addMonths, format, startOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import CalendarGrid from '../components/calendar/CalendarGrid';
import Filters from '../components/calendar/Filters';
import MonthSummary from '../components/calendar/MonthSummary';
import DayDetailModal from '../components/calendar/DayDetailModal';
import {
  type CalendarFilters,
  normalizeCalendarFilters,
} from '../lib/calendarApi';
import { useMonthAggregates } from '../hooks/useMonthAggregates';
import { listCategories, type CategoryRecord } from '../lib/api-categories';
import { listAccounts, type AccountRecord } from '../lib/api';
import { getCurrentUserId } from '../lib/session';
import { useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../layout/Breadcrumbs';

const DEFAULT_FILTERS: CalendarFilters = {
  type: 'expense',
  categoryIds: [],
  accountId: null,
  minAmount: null,
  maxAmount: null,
  search: '',
};

function createDefaultFilters(): CalendarFilters {
  return {
    ...DEFAULT_FILTERS,
    categoryIds: [],
  };
}

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [filters, setFilters] = useState<CalendarFilters>(() => {
    const initialFilters = createDefaultFilters();
    const typeParam = searchParams.get('t');
    if (typeParam === 'debt' || typeParam === 'all') {
      initialFilters.type = 'debt';
    } else {
      initialFilters.type = 'expense';
    }
    return initialFilters;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const normalizedFilters = useMemo(
    () => normalizeCalendarFilters(filters),
    [filters],
  );

  const categoriesQuery = useQuery<CategoryRecord[]>({
    queryKey: ['calendar', 'categories'],
    queryFn: ({ signal }) => listCategories(signal),
    staleTime: 5 * 60_000,
  });

  const accountsQuery = useQuery<AccountRecord[]>({
    queryKey: ['calendar', 'accounts'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      if (!userId) return [];
      return listAccounts(userId);
    },
    staleTime: 5 * 60_000,
  });

  const monthQuery = useMonthAggregates(currentMonth, normalizedFilters);

  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: localeId });
  const headerDescription =
    normalizedFilters.mode === 'debts'
      ? 'Lihat jadwal hutang jatuh tempo per hari'
      : 'Lihat ringkasan pengeluaran dan pemasukan per hari';

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => startOfMonth(addMonths(prev, -1)));
    setSelectedDate(null);
    setDetailOpen(false);
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => startOfMonth(addMonths(prev, 1)));
    setSelectedDate(null);
    setDetailOpen(false);
  };

  const handleToday = () => {
    const todayMonth = startOfMonth(new Date());
    setCurrentMonth(todayMonth);
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    setDetailOpen(true);
  };

  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setDetailOpen(true);
  };

  const handleFiltersChange = (next: CalendarFilters) => {
    const nextFilters = { ...next, categoryIds: [...next.categoryIds] };
    setFilters(nextFilters);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('t', nextFilters.type);
      return params;
    });
  };

  const resetFilters = () => {
    setFilters(createDefaultFilters());
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('t', 'expense');
      return params;
    });
  };

  const daySummaries = monthQuery.data?.daySummaries ?? {};
  const stats = monthQuery.data?.stats ?? { p80: 0, p95: 0, maxExpense: 0 };
  const totals = monthQuery.data?.totals ?? {
    expense: 0,
    income: 0,
    net: 0,
    previousExpense: 0,
    momExpenseChange: null,
  };
  const totalItems = Object.values(daySummaries).reduce(
    (acc, summary) => acc + (summary?.count ?? 0),
    0,
  );

  const isGridLoading = monthQuery.isLoading || monthQuery.isFetching;

  const categories = categoriesQuery.data ?? [];
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories],
  );
  const accounts = accountsQuery.data ?? [];
  const selectedCategories = useMemo(() => {
    if (filters.type === 'debt') return [];
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    return filters.categoryIds
      .map((id) => categoryMap.get(id))
      .filter(Boolean) as CategoryRecord[];
  }, [categories, filters.categoryIds, filters.type]);
  const categorySummaryLabel = useMemo(() => {
    if (filters.type === 'debt') return 'Tidak tersedia untuk hutang';
    if (filters.categoryIds.length === 0) return 'Semua kategori';
    if (selectedCategories.length === 1) return selectedCategories[0]?.name || 'Kategori terpilih';
    return `${selectedCategories.length} kategori dipilih`;
  }, [filters.categoryIds.length, filters.type, selectedCategories]);

  useEffect(() => {
    const typeParam = searchParams.get('t');
    const nextType = typeParam === 'debt' || typeParam === 'all' ? 'debt' : 'expense';
    setFilters((prev) => {
      if (prev.type === nextType) {
        return prev;
      }
      return { ...prev, type: nextType };
    });
  }, [searchParams]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex min-w-0 flex-col gap-2">
            <Breadcrumbs />
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-slate-100">Kalender</h1>
                <p className="mt-1 text-sm text-slate-400">{headerDescription}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  aria-label="Bulan sebelumnya"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200">
                  {monthLabel}
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  aria-label="Bulan berikutnya"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  aria-label="Kembali ke hari ini"
                >
                  Today
                </button>
              </div>
            </header>
          </div>

          <Filters
            value={filters}
            onChange={handleFiltersChange}
            onReset={resetFilters}
            categories={expenseCategories}
            accounts={accounts}
            loadingCategories={categoriesQuery.isLoading}
            loadingAccounts={accountsQuery.isLoading}
          />

          {monthQuery.isError ? (
            <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              <p>Gagal memuat kalender. Coba lagi?</p>
              <button
                type="button"
                onClick={() => monthQuery.refetch()}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 px-4 font-semibold text-rose-100 transition hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              >
                Muat ulang
              </button>
            </div>
          ) : null}

          <CalendarGrid
            month={currentMonth}
            selectedDate={selectedDate}
            summaries={daySummaries}
            p80={stats.p80}
            p95={stats.p95}
            maxExpense={stats.maxExpense}
            onSelectDate={handleSelectDate}
            isLoading={isGridLoading}
            mode={normalizedFilters.mode}
          />
        </div>

        <div className="min-w-0 space-y-6 lg:sticky lg:top-[calc(var(--app-topbar-h,64px)+1.5rem)]">
          <section
            aria-label="Kategori terpilih"
            className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Tag className="mt-0.5 h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-100">Kategori</p>
                <p className="text-xs text-slate-400">Kategori membantu analisis transaksi</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-200">
                {categorySummaryLabel}
              </span>
              {filters.type !== 'debt' && filters.categoryIds.length > 0
                ? selectedCategories.map((category) => (
                    <span
                      key={category.id}
                      className="rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-slate-200"
                    >
                      {category.name}
                    </span>
                  ))
                : null}
            </div>
          </section>
          <MonthSummary
            month={currentMonth}
            expense={totals.expense}
            income={totals.income}
            net={totals.net}
            previousExpense={totals.previousExpense}
            momExpenseChange={totals.momExpenseChange}
            isLoading={monthQuery.isFetching}
            mode={normalizedFilters.mode}
            itemCount={totalItems}
          />
        </div>
      </div>

      <DayDetailModal
        open={detailOpen}
        date={selectedDate}
        filters={normalizedFilters}
        categories={expenseCategories}
        accounts={accounts}
        onClose={() => setDetailOpen(false)}
        onDeleted={() => monthQuery.refetch()}
      />
    </div>
  );
}
