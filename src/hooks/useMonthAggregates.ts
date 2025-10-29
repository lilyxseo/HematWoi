import { useMemo } from 'react';
import { format, startOfMonth } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarFilters,
  CalendarTransaction,
  fetchMonthTransactions,
  fetchPreviousMonthTotals,
  serializeFilters,
} from '../lib/calendarApi';

export type HeatmapLevel =
  | 'none'
  | 'quarter'
  | 'half'
  | 'three-quarter'
  | 'full'
  | 'beyond';

export type DaySummary = {
  date: string;
  expenseTotal: number;
  incomeTotal: number;
  transactionCount: number;
  heatmapLevel: HeatmapLevel;
};

export type MonthTotals = {
  expense: number;
  income: number;
  net: number;
};

export type MonthChange = {
  expensePct: number | null;
  incomePct: number | null;
  netPct: number | null;
};

export interface MonthAggregatesResult {
  data: DaySummary[];
  totals: MonthTotals;
  percentiles: { p80: number; p95: number; max: number };
  change: MonthChange;
  rawTransactions: CalendarTransaction[];
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

function percentile(values: number[], percentileValue: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function computeHeatmapLevel(value: number, p80: number, p95: number): HeatmapLevel {
  if (value <= 0) return 'none';
  if (!p80 && !p95) {
    return value > 0 ? 'quarter' : 'none';
  }
  const baseline = p95 || p80 || value;
  const ratio = baseline > 0 ? value / baseline : 0;
  if (ratio <= 0.25) return 'quarter';
  if (ratio <= 0.5) return 'half';
  if (ratio <= 0.75) return 'three-quarter';
  if (ratio <= 1) return 'full';
  return 'beyond';
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function useMonthAggregates(
  month: Date,
  filters: CalendarFilters,
): MonthAggregatesResult {
  const monthKey = format(startOfMonth(month), 'yyyy-MM');
  const filterKey = serializeFilters(filters);

  const monthQuery = useQuery({
    queryKey: ['calendar', 'month', monthKey, filterKey],
    queryFn: () => fetchMonthTransactions({ month, filters }),
    staleTime: 2 * 60 * 1000,
  });

  const previousTotalsQuery = useQuery({
    queryKey: ['calendar', 'month-prev', monthKey, filterKey],
    queryFn: () => fetchPreviousMonthTotals({ month, filters }),
    enabled: monthQuery.status === 'success',
    staleTime: 5 * 60 * 1000,
  });

  const summaries = useMemo(() => {
    const rows = monthQuery.data ?? [];
    const expenseByDay = new Map<string, number>();
    const incomeByDay = new Map<string, number>();
    const countByDay = new Map<string, number>();

    rows.forEach((row) => {
      const day = String(row.date).slice(0, 10);
      if (!day) return;
      if (row.type === 'expense') {
        expenseByDay.set(day, (expenseByDay.get(day) ?? 0) + row.amount);
      } else if (row.type === 'income') {
        incomeByDay.set(day, (incomeByDay.get(day) ?? 0) + row.amount);
      }
      countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
    });

    const expenseValues = Array.from(expenseByDay.values());
    const p80 = percentile(expenseValues, 80);
    const p95 = percentile(expenseValues, 95);
    const max = expenseValues.length ? Math.max(...expenseValues) : 0;

    const days = new Set<string>();
    rows.forEach((row) => {
      days.add(String(row.date).slice(0, 10));
    });

    const start = startOfMonth(month);
    const totalDays = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= totalDays; i += 1) {
      const day = format(new Date(start.getFullYear(), start.getMonth(), i), 'yyyy-MM-dd');
      days.add(day);
    }

    const list: DaySummary[] = Array.from(days)
      .sort()
      .map((day) => {
        const expenseTotal = expenseByDay.get(day) ?? 0;
        const incomeTotal = incomeByDay.get(day) ?? 0;
        const heatmapLevel = computeHeatmapLevel(expenseTotal, p80, p95);
        return {
          date: day,
          expenseTotal,
          incomeTotal,
          transactionCount: countByDay.get(day) ?? 0,
          heatmapLevel,
        } satisfies DaySummary;
      });

    const totals = rows.reduce(
      (acc, row) => {
        if (row.type === 'expense') {
          acc.expense += row.amount;
        } else if (row.type === 'income') {
          acc.income += row.amount;
        }
        return acc;
      },
      { expense: 0, income: 0 },
    );

    return {
      list,
      percentiles: { p80, p95, max },
      totals: { ...totals, net: totals.income - totals.expense },
    };
  }, [month, monthQuery.data]);

  const change = useMemo<MonthChange>(() => {
    if (!previousTotalsQuery.data) {
      return { expensePct: null, incomePct: null, netPct: null };
    }
    const current = summaries?.totals ?? { expense: 0, income: 0, net: 0 };
    const previous = previousTotalsQuery.data;
    return {
      expensePct: percentChange(current.expense, previous.expense),
      incomePct: percentChange(current.income, previous.income),
      netPct: percentChange(current.net, previous.income - previous.expense),
    };
  }, [previousTotalsQuery.data, summaries?.totals]);

  return {
    data: summaries?.list ?? [],
    totals: summaries?.totals ?? { expense: 0, income: 0, net: 0 },
    percentiles: summaries?.percentiles ?? { p80: 0, p95: 0, max: 0 },
    change,
    rawTransactions: monthQuery.data ?? [],
    isLoading: monthQuery.isLoading,
    isFetching: monthQuery.isFetching,
    refetch: monthQuery.refetch,
  };
}
