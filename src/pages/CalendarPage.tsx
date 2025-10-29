import { useMemo, useState } from 'react';
import { addMonths, format, startOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, Sun } from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import CalendarGrid from '../components/calendar/CalendarGrid';
import Filters from '../components/calendar/Filters';
import DayDetailModal from '../components/calendar/DayDetailModal';
import MonthSummary from '../components/calendar/MonthSummary';
import { useMonthAggregates } from '../hooks/useMonthAggregates';
import { CalendarFilters } from '../lib/calendarApi';
import { fetchCategoriesSafe } from '../services/categories';
import { listAccounts } from '../lib/api';
import { getCurrentUserId } from '../lib/session';

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [filters, setFilters] = useState<CalendarFilters>({
    includeIncome: true,
    categoryIds: [],
    accountIds: [],
    minAmount: undefined,
    maxAmount: undefined,
    search: '',
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ['calendar', 'categories'],
    queryFn: () => fetchCategoriesSafe({ types: ['expense', 'income'] }),
    staleTime: 10 * 60 * 1000,
  });

  const accountsQuery = useQuery({
    queryKey: ['calendar', 'accounts'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      if (!userId) return [];
      return listAccounts(userId);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data, totals, change, isLoading, isFetching } = useMonthAggregates(
    month,
    filters,
  );

  const categoryOptions = useMemo(() => {
    return (categoriesQuery.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      meta: item.type === 'income' ? 'Income' : 'Expense',
    }));
  }, [categoriesQuery.data]);

  const accountOptions = useMemo(() => {
    return (accountsQuery.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
    }));
  }, [accountsQuery.data]);

  const categoryLookup = useMemo(() => {
    return new Map(categoryOptions.map((item) => [item.id, item.name]));
  }, [categoryOptions]);

  const accountLookup = useMemo(() => {
    return new Map(accountOptions.map((item) => [item.id, item.name]));
  }, [accountOptions]);

  const handleMonthChange = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setMonth(startOfMonth(new Date()));
      return;
    }
    setMonth((prev) => addMonths(prev, direction === 'prev' ? -1 : 1));
  };

  const handleSelectDay = (day: string) => {
    setSelectedDay(day);
    setDetailOpen(true);
  };

  const monthLabel = format(month, 'MMMM yyyy', { locale: localeId });

  return (
    <Page maxWidthClassName="max-w-6xl">
      <PageHeader
        title="Kalender"
        description="Lihat ringkasan pemasukan dan pengeluaran per hari dengan cepat."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleMonthChange('prev')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-1 text-slate-200 transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="rounded-xl border border-border bg-surface-1 px-4 py-2 text-sm font-medium text-slate-100">
            <Calendar className="mr-2 inline h-4 w-4" aria-hidden="true" />
            {monthLabel}
          </div>
          <button
            type="button"
            onClick={() => handleMonthChange('next')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-1 text-slate-200 transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleMonthChange('today')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface-1 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Sun className="h-4 w-4" aria-hidden="true" />
            Hari ini
          </button>
        </div>
      </PageHeader>

      <div className="flex flex-col gap-6">
        <Filters
          value={filters}
          onChange={setFilters}
          categories={categoryOptions}
          accounts={accountOptions}
          loading={categoriesQuery.isLoading || accountsQuery.isLoading}
        />

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border/60 bg-surface-2/60 p-4 shadow-sm">
              <CalendarGrid
                month={month}
                onMonthChange={setMonth}
                summaries={data}
                selectedDay={selectedDay}
                onSelectDay={handleSelectDay}
              />
            </div>
          </div>
          <MonthSummary
            month={month}
            totals={totals}
            change={change}
            isLoading={isLoading || isFetching}
          />
        </div>
      </div>

      <DayDetailModal
        date={selectedDay}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        filters={filters}
        categoryLookup={categoryLookup}
        accountLookup={accountLookup}
      />
    </Page>
  );
}
