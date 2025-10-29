import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isValid, parse, parseISO, startOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import CalendarGrid from '../components/calendar/CalendarGrid';
import Filters from '../components/calendar/Filters';
import DayDetailModal from '../components/calendar/DayDetailModal';
import useMonthAggregates from '../hooks/useMonthAggregates';
import useDayTransactions from '../hooks/useDayTransactions';
import useCategories from '../hooks/useCategories';
import { listAccounts } from '../lib/api';
import type { CalendarFilters } from '../lib/calendarApi';
import { formatCurrency } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { removeTransaction } from '../lib/api-transactions';

function parseMonthParam(value: string | null): Date {
  if (!value) {
    return startOfMonth(new Date());
  }
  const parsed = parse(`${value}-01`, 'yyyy-MM-dd', new Date());
  if (!isValid(parsed)) {
    return startOfMonth(new Date());
  }
  return startOfMonth(parsed);
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    if (!isValid(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readFilters(params: URLSearchParams): CalendarFilters {
  const typeParam = params.get('type');
  const categoriesParam = params.get('categories');
  const accountsParam = params.get('accounts');
  const minParam = params.get('min');
  const maxParam = params.get('max');
  const searchParam = params.get('q');
  const categories = categoriesParam ? categoriesParam.split(',').filter(Boolean) : [];
  const accounts = accountsParam ? accountsParam.split(',').filter(Boolean) : [];
  const minAmount = minParam ? Number(minParam) : null;
  const maxAmount = maxParam ? Number(maxParam) : null;
  return {
    type: typeParam === 'all' ? 'all' : 'expense',
    categories,
    accounts,
    minAmount: Number.isFinite(minAmount) ? (minAmount as number) : null,
    maxAmount: Number.isFinite(maxAmount) ? (maxAmount as number) : null,
    search: searchParam ?? '',
  };
}

function computeChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  const formatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 1,
    signDisplay: 'always',
  });
  return `${formatter.format(value)}%`;
}

function MonthSummary({
  expense,
  income,
  net,
  previousExpense,
  previousIncome,
  loading,
}: {
  expense: number;
  income: number;
  net: number;
  previousExpense: number;
  previousIncome: number;
  loading: boolean;
}) {
  const cards = [
    {
      key: 'expense',
      title: 'Expense MTD',
      value: expense,
      change: computeChange(expense, previousExpense),
      accent: 'text-rose-300',
    },
    {
      key: 'income',
      title: 'Income MTD',
      value: income,
      change: computeChange(income, previousIncome),
      accent: 'text-emerald-300',
    },
    {
      key: 'net',
      title: 'Net MTD',
      value: net,
      change: null,
      accent: 'text-slate-200',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className="flex flex-col gap-1 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {card.title}
          </span>
          <span className={`text-lg font-semibold ${card.accent}`}>
            {loading ? '…' : formatCurrency(card.value, 'IDR')}
          </span>
          <span className="text-xs text-slate-400">
            {card.change != null ? formatPercent(card.change) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentMonth = useMemo(
    () => parseMonthParam(searchParams.get('month')),
    [searchParams],
  );
  const selectedDate = useMemo(
    () => parseDateParam(searchParams.get('date')),
    [searchParams],
  );
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const categoriesResult = useCategories();
  const accountsQuery = useQuery({
    queryKey: ['calendar', 'accounts'],
    queryFn: async () => {
      const rows = await listAccounts();
      return rows.map((row: any) => ({
        id: String(row.id ?? ''),
        name: row.name ?? 'Tanpa nama',
      }));
    },
  });

  const monthAggregates = useMonthAggregates({ month: currentMonth, filters });
  const dayTransactions = useDayTransactions({
    date: selectedDate,
    filters,
    enabled: Boolean(selectedDate),
  });

  const selectedKey = selectedDate
    ? format(selectedDate, 'yyyy-MM-dd', { locale: localeId })
    : null;
  const dayAggregate = selectedKey
    ? monthAggregates.data?.days?.[selectedKey]
    : undefined;

  const showIncome = filters.type === 'all';

  const handleMonthChange = useCallback(
    (next: Date) => {
      const monthValue = format(next, 'yyyy-MM');
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('month', monthValue);
      if (selectedDate) {
        const sameMonth = format(next, 'yyyy-MM') === format(selectedDate, 'yyyy-MM');
        if (!sameMonth) {
          nextParams.delete('date');
        }
      }
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, selectedDate, setSearchParams],
  );

  const handleToday = useCallback(() => {
    const today = new Date();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('month', format(today, 'yyyy-MM'));
    nextParams.set('date', format(today, 'yyyy-MM-dd'));
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSelectDate = useCallback(
    (date: Date) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('date', format(date, 'yyyy-MM-dd'));
      nextParams.set('month', format(startOfMonth(date), 'yyyy-MM'));
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleFilterChange = useCallback(
    (value: Partial<CalendarFilters>) => {
      const nextFilters: CalendarFilters = {
        ...filters,
        ...value,
      };
      const nextParams = new URLSearchParams(searchParams);

      if (nextFilters.type === 'all') {
        nextParams.set('type', 'all');
      } else {
        nextParams.delete('type');
      }

      const categories = (nextFilters.categories ?? []).filter(Boolean);
      if (categories.length) {
        nextParams.set('categories', categories.join(','));
      } else {
        nextParams.delete('categories');
      }

      const accounts = (nextFilters.accounts ?? []).filter(Boolean);
      if (accounts.length) {
        nextParams.set('accounts', accounts.join(','));
      } else {
        nextParams.delete('accounts');
      }

      if (nextFilters.minAmount != null && Number.isFinite(nextFilters.minAmount)) {
        nextParams.set('min', String(nextFilters.minAmount));
      } else {
        nextParams.delete('min');
      }

      if (nextFilters.maxAmount != null && Number.isFinite(nextFilters.maxAmount)) {
        nextParams.set('max', String(nextFilters.maxAmount));
      } else {
        nextParams.delete('max');
      }

      const search = nextFilters.search?.trim() ?? '';
      if (search) {
        nextParams.set('q', search);
      } else {
        nextParams.delete('q');
      }

      setSearchParams(nextParams, { replace: true });
    },
    [filters, searchParams, setSearchParams],
  );

  const handleResetFilters = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('type');
    nextParams.delete('categories');
    nextParams.delete('accounts');
    nextParams.delete('min');
    nextParams.delete('max');
    nextParams.delete('q');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleCloseModal = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('date');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleEditTransaction = useCallback(
    (transaction) => {
      if (!transaction?.id) return;
      navigate('/transactions', {
        state: { editTransactionId: transaction.id },
      });
      handleCloseModal();
    },
    [handleCloseModal, navigate],
  );

  const handleDeleteTransaction = useCallback(
    async (transaction) => {
      if (!transaction?.id) return;
      const confirmed = window.confirm('Hapus transaksi ini?');
      if (!confirmed) return;
      try {
        await removeTransaction(transaction.id);
        addToast('Transaksi dihapus', 'success');
        await Promise.all([
          monthAggregates.refetch(),
          dayTransactions.refetch(),
        ]);
      } catch (error: any) {
        addToast(error?.message ?? 'Gagal menghapus transaksi', 'error');
      }
    },
    [addToast, dayTransactions, monthAggregates],
  );

  const categories = useMemo(
    () =>
      (categoriesResult.data ?? []).map((item) => ({
        id: String(item.id ?? ''),
        name: item.name ?? 'Tanpa nama',
        color: item.color ?? null,
      })),
    [categoriesResult.data],
  );

  const accounts = useMemo(
    () =>
      (accountsQuery.data ?? []).filter((item) => item.id),
    [accountsQuery.data],
  );

  return (
    <Page maxWidthClassName="max-w-[1280px]">
      <PageHeader
        title="Kalender"
        description="Pantau pengeluaran harian dan detail transaksi"
      >
        <MonthSummary
          expense={monthAggregates.data?.expenseTotal ?? 0}
          income={monthAggregates.data?.incomeTotal ?? 0}
          net={monthAggregates.data?.netTotal ?? 0}
          previousExpense={monthAggregates.data?.previousExpenseTotal ?? 0}
          previousIncome={monthAggregates.data?.previousIncomeTotal ?? 0}
          loading={monthAggregates.isPending}
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <CalendarGrid
          month={currentMonth}
          aggregates={monthAggregates.data?.days ?? {}}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          onMonthChange={handleMonthChange}
          onToday={handleToday}
          showIncome={showIncome}
          loading={monthAggregates.isPending}
          maxExpense={monthAggregates.data?.maxExpense ?? 0}
          p80Expense={monthAggregates.data?.p80Expense ?? 0}
          p95Expense={monthAggregates.data?.p95Expense ?? 0}
        />
        <Filters
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          categories={categories}
          accounts={accounts}
          loadingCategories={categoriesResult.isLoading}
          loadingAccounts={accountsQuery.isLoading}
        />
      </div>

      <DayDetailModal
        open={Boolean(selectedDate)}
        date={selectedDate}
        aggregate={dayAggregate}
        transactions={dayTransactions.data ?? []}
        loading={dayTransactions.isPending}
        onClose={handleCloseModal}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
      />
    </Page>
  );
}
