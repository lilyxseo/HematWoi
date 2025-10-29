import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Page from '../layout/Page';
import CalendarGrid from '../components/calendar/CalendarGrid';
import Filters from '../components/calendar/Filters';
import DayDetailModal from '../components/calendar/DayDetailModal';
import useMonthAggregates from '../hooks/useMonthAggregates';
import useDayTransactions from '../hooks/useDayTransactions';
import type { CalendarFilterState } from '../lib/calendarApi';
import useCategories from '../hooks/useCategories';
import { listAccounts } from '../lib/api';
import { formatCurrency } from '../lib/format';

const MONTH_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

const DEFAULT_FILTERS: CalendarFilterState = {
  mode: 'all',
  categories: [],
  accounts: [],
  minAmount: null,
  maxAmount: null,
  search: '',
};

type AccountOption = {
  id: string;
  name: string;
};

function getTodayKey(): string {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = `${today.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${today.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMonths(base: Date, amount: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + amount, 1));
}

function MonthSummary({
  loading,
  expense,
  income,
  net,
  mom,
}: {
  loading: boolean;
  expense: number;
  income: number;
  net: number;
  mom: number | null;
}) {
  const momLabel = useMemo(() => {
    if (mom == null) return 'Tidak ada data bulan lalu';
    const formatted = mom.toFixed(1);
    const prefix = mom > 0 ? '+' : '';
    return `${prefix}${formatted}% vs bulan lalu`;
  }, [mom]);

  const momColor = mom == null ? 'text-muted' : mom > 0 ? 'text-rose-400' : 'text-emerald-400';

  if (loading) {
    return (
      <aside className="rounded-2xl border border-border bg-surface-1/70 p-4 shadow-sm sm:p-5">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`summary-skeleton-${index}`} className="animate-pulse rounded-xl border border-border/40 bg-surface-2/60 p-4">
              <div className="h-4 w-1/3 rounded bg-border/60" />
              <div className="mt-3 h-6 w-2/3 rounded bg-border/50" />
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-border bg-surface-1/70 p-4 shadow-sm sm:p-5">
      <h3 className="text-base font-semibold text-text">Ringkasan Bulan Ini</h3>
      <dl className="mt-4 space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">Total Pengeluaran</dt>
          <dd className="font-semibold text-rose-400">-{formatCurrency(expense, 'IDR')}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Total Pemasukan</dt>
          <dd className="font-semibold text-emerald-400">{formatCurrency(income, 'IDR')}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Net</dt>
          <dd className="font-semibold text-text">{formatCurrency(net, 'IDR')}</dd>
        </div>
      </dl>
      <div className="mt-6 rounded-xl border border-border/70 bg-surface-2/70 p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Perbandingan Bulan Lalu</p>
        <p className={`mt-2 text-base font-semibold ${momColor}`}>{momLabel}</p>
      </div>
    </aside>
  );
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFilterState>(DEFAULT_FILTERS);

  const { data: categoryList, isLoading: categoriesLoading } = useCategories(['expense', 'income']);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setAccountsLoading(true);
      try {
        const rows = await listAccounts();
        if (cancelled) return;
        setAccounts(
          rows
            .map((row) => ({ id: row.id, name: row.name ?? 'Tanpa nama' }))
            .filter((row) => Boolean(row.id))
        );
      } catch (error) {
        console.error('[calendar] gagal memuat akun', error);
        if (!cancelled) setAccounts([]);
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const monthQuery = useMonthAggregates(month, filters);
  const dayQuery = useDayTransactions(selectedDate, filters);

  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    (categoryList ?? []).forEach((category) => {
      map.set(category.id, category.name);
    });
    return map;
  }, [categoryList]);

  const accountLookup = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((account) => {
      map.set(account.id, account.name);
    });
    return map;
  }, [accounts]);

  const monthLabel = useMemo(() => MONTH_FORMATTER.format(month), [month]);

  const handleMonthChange = (offset: number) => {
    setMonth((current) => addMonths(current, offset));
    setSelectedDate(null);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
  };

  const handleGoToday = () => {
    const today = new Date();
    const newMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    setMonth(newMonth);
    setSelectedDate(getTodayKey());
  };

  const handleFiltersChange = (next: CalendarFilterState) => {
    setFilters(next);
  };

  const handleTransactionDeleted = () => {
    void queryClient.invalidateQueries({ queryKey: ['calendar-month'] });
    void queryClient.invalidateQueries({ queryKey: ['calendar-day'] });
  };

  const aggregates = monthQuery.data?.days ?? {};
  const percentiles = monthQuery.data?.percentiles ?? { p80: 0, p95: 0, maxExpense: 0 };
  const summary = monthQuery.data?.summary ?? {
    expenseTotal: 0,
    incomeTotal: 0,
    netTotal: 0,
    previousExpenseTotal: 0,
    momExpensePercent: null,
  };

  const categoriesForFilters = useMemo(
    () => (categoryList ?? []).map((item) => ({ id: item.id, name: item.name })),
    [categoryList],
  );

  return (
    <Page className="flex flex-col gap-6" maxWidthClassName="max-w-6xl">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text">Kalender Keuangan</h1>
            <p className="text-sm text-muted">Pantau pengeluaran dan pemasukan per hari.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleMonthChange(-1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-1 text-text shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-[140px] text-center text-sm font-semibold text-text">{monthLabel}</div>
          <button
            type="button"
            onClick={() => handleMonthChange(1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-1 text-text shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleGoToday}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm font-semibold text-text shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            aria-label="Kembali ke hari ini"
          >
            Today
          </button>
        </div>
      </section>
      <Filters
        value={filters}
        onChange={handleFiltersChange}
        categories={categoriesForFilters}
        categoriesLoading={categoriesLoading}
        accounts={accounts}
        accountsLoading={accountsLoading}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <CalendarGrid
          month={month}
          aggregates={aggregates}
          percentiles={percentiles}
          loading={monthQuery.isLoading}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
        />
        <MonthSummary
          loading={monthQuery.isLoading}
          expense={summary.expenseTotal}
          income={summary.incomeTotal}
          net={summary.netTotal}
          mom={summary.momExpensePercent}
        />
      </div>
      <DayDetailModal
        open={Boolean(selectedDate)}
        dateKey={selectedDate}
        data={dayQuery.data}
        loading={dayQuery.isLoading}
        onClose={() => setSelectedDate(null)}
        categoryLookup={categoryLookup}
        accountLookup={accountLookup}
        onDeleted={handleTransactionDeleted}
      />
    </Page>
  );
}
