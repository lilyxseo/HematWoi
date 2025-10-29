import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import CalendarGrid from '../components/calendar/CalendarGrid';
import Filters, { FilterOption } from '../components/calendar/Filters';
import DayDetailModal from '../components/calendar/DayDetailModal';
import {
  CalendarFilters,
  fetchAccounts,
} from '../lib/calendarApi';
import { useMonthAggregates } from '../hooks/useMonthAggregates';
import { fetchCategoriesSafe } from '../services/categories';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';

const DEFAULT_FILTERS: CalendarFilters = {
  includeIncome: false,
  categories: [],
  accountId: null,
  amountMin: null,
  amountMax: null,
  search: '',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function MonthSummary({
  totalExpense,
  totalIncome,
  previousExpense,
  monthLabel,
  previousLabel,
}: {
  totalExpense: number;
  totalIncome: number;
  previousExpense: number;
  monthLabel: string;
  previousLabel: string;
}) {
  const net = totalIncome - totalExpense;
  const diff = totalExpense - previousExpense;
  const percent = previousExpense === 0 ? (totalExpense > 0 ? 100 : 0) : (diff / previousExpense) * 100;
  const percentLabel = `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;

  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-3xl border border-border/60 bg-surface-1/80 p-4 text-text shadow-sm">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/20 text-brand">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-300">Ringkasan {monthLabel}</p>
          <p className="text-xs text-slate-500">Dibanding {previousLabel}</p>
        </div>
      </header>
      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between rounded-2xl bg-surface-2/70 px-4 py-3">
          <dt className="text-slate-300">Total Expense</dt>
          <dd className="font-semibold text-rose-300">{formatCurrency(totalExpense)}</dd>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-surface-2/70 px-4 py-3">
          <dt className="text-slate-300">Total Income</dt>
          <dd className="font-semibold text-emerald-300">{formatCurrency(totalIncome)}</dd>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-surface-2/70 px-4 py-3">
          <dt className="text-slate-300">Net</dt>
          <dd className={net >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
            {formatCurrency(net)}
          </dd>
        </div>
      </dl>
      <div className="rounded-2xl border border-border/50 bg-slate-900/40 px-4 py-3 text-sm">
        <p className="text-slate-300">Expense MoM</p>
        <p className={diff >= 0 ? 'text-rose-300' : 'text-emerald-300'}>
          {diff >= 0 ? '+' : ''}{formatCurrency(diff)} ({percentLabel})
        </p>
      </div>
    </section>
  );
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const monthState = useMonthAggregates(month, filters);

  const { data: categoryData = [], isLoading: categoryLoading } = useQuery({
    queryKey: ['calendar', 'categories'],
    queryFn: async (): Promise<FilterOption[]> => {
      try {
        const rows = await fetchCategoriesSafe({ types: ['expense', 'income'], withOrdering: true });
        return rows.map((row) => ({ id: row.id, name: row.name }));
      } catch (error) {
        console.error('Gagal memuat kategori kalender', error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: accountsData = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['calendar', 'accounts'],
    queryFn: async (): Promise<FilterOption[]> => {
      try {
        const rows = await fetchAccounts();
        return rows.map((row) => ({ id: row.id, name: row.name }));
      } catch (error) {
        console.error('Gagal memuat akun untuk kalender', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const handlePrevMonth = () => {
    setMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setMonth((prev) => addMonths(prev, 1));
  };

  const handleToday = () => {
    setMonth(startOfMonth(new Date()));
  };

  const handleFilterChange = (next: Partial<CalendarFilters>) => {
    setFilters((prev) => {
      const merged: CalendarFilters = {
        ...prev,
        ...next,
        categories: next.categories
          ? Array.from(new Set(next.categories)).sort()
          : prev.categories,
        search:
          typeof next.search === 'string'
            ? next.search
            : typeof prev.search === 'string'
              ? prev.search
              : '',
      };
      return merged;
    });
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleSelectDay = (date: string) => {
    setSelectedDate(date);
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedDate(null);
  };

  const monthLabel = useMemo(() => format(monthState.currentMonth, 'MMMM yyyy', { locale: localeId }), [monthState.currentMonth]);
  const previousLabel = useMemo(() => format(monthState.previousMonth, 'MMMM yyyy', { locale: localeId }), [monthState.previousMonth]);

  const selectedSummary = selectedDate ? monthState.data?.dayMap[selectedDate] : undefined;

  return (
    <Page>
      <PageHeader
        title="Kalender"
        description="Ringkas transaksi harian dalam tampilan kalender."
      />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/60 bg-surface-1/80 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Bulan aktif</p>
            <h2 className="text-xl font-semibold text-white">{monthLabel}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-surface-2 text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-border/60 bg-surface-2 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Kembali ke bulan ini"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-surface-2 text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <Filters
          value={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          categories={categoryData}
          accounts={accountsData}
          loading={categoryLoading || accountsLoading}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="min-w-0">
            <CalendarGrid
              month={monthState.currentMonth}
              days={monthState.days}
              onSelectDay={handleSelectDay}
              selectedDate={selectedDate}
              heatmap={monthState.data?.percentiles ?? { p80: 0, p95: 0, max: 0 }}
              isLoading={monthState.isLoading || monthState.isFetching}
            />
          </div>
          <div className="min-w-0">
            <MonthSummary
              totalExpense={monthState.data?.totalExpense ?? 0}
              totalIncome={monthState.data?.totalIncome ?? 0}
              previousExpense={monthState.data?.previousExpense ?? 0}
              monthLabel={monthLabel}
              previousLabel={previousLabel}
            />
          </div>
        </div>
      </div>

      <DayDetailModal
        open={detailOpen}
        date={selectedDate}
        onClose={handleCloseDetail}
        filters={filters}
        summary={selectedSummary}
      />
    </Page>
  );
}
