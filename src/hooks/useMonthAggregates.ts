import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchMonthTransactions,
  type CalendarFilterState,
  type CalendarTransaction,
} from '../lib/calendarApi';

export type DayAggregate = {
  date: string;
  expenseTotal: number;
  incomeTotal: number;
  transactionCount: number;
};

export type MonthAggregatesResult = {
  days: Record<string, DayAggregate>;
  summary: {
    expenseTotal: number;
    incomeTotal: number;
    netTotal: number;
    previousExpenseTotal: number;
    momExpensePercent: number | null;
  };
  percentiles: {
    p80: number;
    p95: number;
    maxExpense: number;
  };
  monthKey: string;
  range: { start: string; end: string };
};

function toDateKey(value: Date): string {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function endOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function addMonths(value: Date, amount: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1));
}

function serializeFilters(filters: CalendarFilterState): string {
  const categories = [...filters.categories].sort().join(',');
  const accounts = [...filters.accounts].sort().join(',');
  const min = filters.minAmount ?? '';
  const max = filters.maxAmount ?? '';
  const search = filters.search.trim().toLowerCase();
  return `${filters.mode}|${categories}|${accounts}|${min}|${max}|${search}`;
}

function aggregateTransactions(transactions: CalendarTransaction[]): {
  days: Record<string, DayAggregate>;
  expenseTotal: number;
  incomeTotal: number;
  maxExpense: number;
  p80: number;
  p95: number;
} {
  const days: Record<string, DayAggregate> = {};
  let expenseTotal = 0;
  let incomeTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense' && tx.type !== 'income') {
      continue;
    }
    const key = tx.date;
    if (!days[key]) {
      days[key] = {
        date: key,
        expenseTotal: 0,
        incomeTotal: 0,
        transactionCount: 0,
      };
    }
    const aggregate = days[key];
    aggregate.transactionCount += 1;
    if (tx.type === 'expense') {
      aggregate.expenseTotal += Math.max(0, Number(tx.amount ?? 0));
      expenseTotal += Math.max(0, Number(tx.amount ?? 0));
    } else if (tx.type === 'income') {
      aggregate.incomeTotal += Math.max(0, Number(tx.amount ?? 0));
      incomeTotal += Math.max(0, Number(tx.amount ?? 0));
    }
  }

  const values = Object.values(days)
    .map((item) => item.expenseTotal)
    .filter((value) => Number.isFinite(value) && value > 0);

  const maxExpense = values.length ? Math.max(...values) : 0;

  const sorted = values.slice().sort((a, b) => a - b);

  const p80 = computePercentile(sorted, 0.8);
  const p95 = computePercentile(sorted, 0.95);

  return { days, expenseTotal, incomeTotal, maxExpense, p80, p95 };
}

function computePercentile(sortedValues: number[], percentile: number): number {
  if (!sortedValues.length) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sortedValues.length) {
    return sortedValues[lower];
  }
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * weight;
}

async function computePreviousExpenseTotal(
  monthStart: string,
  filters: CalendarFilterState,
  signal: AbortSignal | undefined,
): Promise<number> {
  const pivot = new Date(`${monthStart}T00:00:00Z`);
  const prevStartDate = toDateKey(startOfMonth(addMonths(pivot, -1)));
  const prevEndDate = toDateKey(endOfMonth(addMonths(pivot, -1)));
  const previousTransactions = await fetchMonthTransactions({
    startDate: prevStartDate,
    endDate: prevEndDate,
    filters,
    signal,
  });
  return previousTransactions.reduce((total, tx) => {
    if (tx.type === 'expense') {
      return total + Math.max(0, Number(tx.amount ?? 0));
    }
    return total;
  }, 0);
}

export default function useMonthAggregates(
  month: Date,
  filters: CalendarFilterState,
) {
  const monthTimestamp = month.getTime();
  const normalizedMonth = useMemo(
    () => startOfMonth(new Date(monthTimestamp)),
    [monthTimestamp],
  );
  const normalizedMonthTimestamp = normalizedMonth.getTime();
  const monthKey = useMemo(
    () => toDateKey(new Date(normalizedMonthTimestamp)),
    [normalizedMonthTimestamp],
  );
  const filtersKey = useMemo(
    () => serializeFilters(filters),
    [
      filters.mode,
      filters.search,
      filters.minAmount,
      filters.maxAmount,
      filters.categories.join(','),
      filters.accounts.join(','),
    ],
  );

  return useQuery<MonthAggregatesResult>({
    queryKey: ['calendar-month', monthKey, filtersKey],
    queryFn: async ({ signal }) => {
      const startDate = toDateKey(normalizedMonth);
      const endDate = toDateKey(endOfMonth(normalizedMonth));
      const transactions = await fetchMonthTransactions({
        startDate,
        endDate,
        filters,
        signal,
      });
      const { days, expenseTotal, incomeTotal, maxExpense, p80, p95 } = aggregateTransactions(transactions);
      const previousExpenseTotal = await computePreviousExpenseTotal(startDate, filters, signal);
      const netTotal = incomeTotal - expenseTotal;
      const momExpensePercent = previousExpenseTotal > 0
        ? ((expenseTotal - previousExpenseTotal) / previousExpenseTotal) * 100
        : null;

      return {
        days,
        summary: {
          expenseTotal,
          incomeTotal,
          netTotal,
          previousExpenseTotal,
          momExpensePercent,
        },
        percentiles: {
          p80,
          p95,
          maxExpense,
        },
        monthKey,
        range: { start: startDate, end: endDate },
      } satisfies MonthAggregatesResult;
    },
    keepPreviousData: true,
    staleTime: 60 * 1000,
  });
}
