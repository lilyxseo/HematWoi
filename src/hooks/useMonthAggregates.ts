import { useMemo } from 'react';
import { addMonths, endOfDay, endOfMonth, format, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  fetchMonthAggregates,
  type CalendarFilter,
  type MonthAggregateResponse,
  type FetchMonthAggregatesParams,
  normalizeCalendarFilter,
  serializeCalendarFilter,
} from '../lib/calendarApi';

export type DayAggregate = {
  date: string;
  expense: number;
  income: number;
  count: number;
};

export type HeatmapStats = {
  maxExpense: number;
  p80: number;
  p95: number;
};

export type MonthSummary = {
  expense: number;
  income: number;
  net: number;
  expenseMoM: number | null;
  incomeMoM: number | null;
};

export type UseMonthAggregatesResult = {
  monthKey: string;
  range: { start: string; end: string };
  days: Record<string, DayAggregate>;
  heatmap: HeatmapStats;
  summary: MonthSummary;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

function toISO(date: Date): string {
  return date.toISOString();
}

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return format(parsed, 'yyyy-MM-dd');
  } catch {
    return null;
  }
}

function percentile(values: number[], percentileRank: number): number {
  if (!values.length) return 0;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentileRank;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sorted.length) {
    return sorted[sorted.length - 1];
  }
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function processMonthRows(rows: MonthAggregateResponse) {
  const days = new Map<string, DayAggregate>();
  const expenseValues: number[] = [];
  let totalExpense = 0;
  let totalIncome = 0;

  rows.forEach((row) => {
    const key = toDateKey(row.transaction_date ?? row.date ?? row.created_at ?? null);
    if (!key) return;
    const existing = days.get(key) ?? { date: key, expense: 0, income: 0, count: 0 };
    const amount = Number(row.amount) || 0;
    if (row.type === 'income') {
      existing.income += amount;
      totalIncome += amount;
    } else if (row.type === 'expense') {
      existing.expense += amount;
      totalExpense += amount;
    }
    existing.count += 1;
    days.set(key, existing);
  });

  const expenseByDay = Array.from(days.values()).map((day) => day.expense);
  expenseValues.push(...expenseByDay.filter((value) => value > 0));

  const maxExpense = expenseValues.length ? Math.max(...expenseValues) : 0;
  const p80 = expenseValues.length ? percentile(expenseValues, 0.8) : 0;
  const p95 = expenseValues.length ? percentile(expenseValues, 0.95) : 0;

  return {
    days: Object.fromEntries(days.entries()),
    totals: {
      expense: totalExpense,
      income: totalIncome,
      net: totalIncome - totalExpense,
    },
    heatmap: {
      maxExpense,
      p80,
      p95,
    },
  };
}

function calculateMoM(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function useMonthAggregates(
  month: Date,
  filters: CalendarFilter,
): UseMonthAggregatesResult {
  const normalizedFilter = useMemo(() => normalizeCalendarFilter(filters), [filters]);
  const filterKey = useMemo(() => serializeCalendarFilter(normalizedFilter), [normalizedFilter]);

  const rangeStart = startOfDay(startOfMonth(month));
  const rangeEnd = endOfDay(endOfMonth(month));
  const monthKey = format(rangeStart, 'yyyy-MM');

  const queryParams: FetchMonthAggregatesParams = useMemo(
    () => ({
      startDate: toISO(rangeStart),
      endDate: toISO(rangeEnd),
      filters: normalizedFilter,
    }),
    [rangeEnd, rangeStart, normalizedFilter],
  );

  const monthQuery = useQuery({
    queryKey: ['calendar', 'month', monthKey, filterKey],
    queryFn: () => fetchMonthAggregates(queryParams),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const previousMonth = useMemo(() => addMonths(rangeStart, -1), [rangeStart]);
  const prevRangeStart = startOfDay(startOfMonth(previousMonth));
  const prevRangeEnd = endOfDay(endOfMonth(previousMonth));

  const prevParams: FetchMonthAggregatesParams = useMemo(
    () => ({
      startDate: toISO(prevRangeStart),
      endDate: toISO(prevRangeEnd),
      filters: normalizedFilter,
    }),
    [prevRangeEnd, prevRangeStart, normalizedFilter],
  );

  const prevQuery = useQuery({
    queryKey: ['calendar', 'month', format(prevRangeStart, 'yyyy-MM'), filterKey],
    queryFn: () => fetchMonthAggregates(prevParams),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const processed = useMemo(() => {
    if (!monthQuery.data) {
      return {
        days: {} as Record<string, DayAggregate>,
        heatmap: { maxExpense: 0, p80: 0, p95: 0 } satisfies HeatmapStats,
        summary: { expense: 0, income: 0, net: 0, expenseMoM: null, incomeMoM: null } satisfies MonthSummary,
      };
    }
    const current = processMonthRows(monthQuery.data);
    const previous = prevQuery.data ? processMonthRows(prevQuery.data) : null;
    const expenseMoM = calculateMoM(current.totals.expense, previous?.totals.expense ?? 0);
    const incomeMoM = calculateMoM(current.totals.income, previous?.totals.income ?? 0);
    return {
      days: current.days,
      heatmap: current.heatmap,
      summary: {
        expense: current.totals.expense,
        income: current.totals.income,
        net: current.totals.net,
        expenseMoM,
        incomeMoM,
      },
    };
  }, [monthQuery.data, prevQuery.data]);

  return {
    monthKey,
    range: { start: queryParams.startDate, end: queryParams.endDate },
    days: processed.days,
    heatmap: processed.heatmap,
    summary: processed.summary,
    isLoading: monthQuery.isLoading,
    isFetching: monthQuery.isFetching,
    error: monthQuery.error as Error | null,
    refetch: async () => {
      await monthQuery.refetch();
    },
  };
}
