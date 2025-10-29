import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  type CalendarFilters,
  fetchMonthAggregates,
  type MonthAggregateResult,
} from '../lib/calendarApi';
import { startOfMonth, endOfMonth } from 'date-fns';

export interface UseMonthAggregatesOptions {
  month: Date;
  filters: CalendarFilters;
}

export interface DayHeatMeta {
  value: number;
  level: number;
}

export interface UseMonthAggregatesResult {
  data: MonthAggregateResult | undefined;
  heatmap: Record<string, DayHeatMeta>;
  isLoading: boolean;
  refetch: () => void;
}

function computePercentileThreshold(values: number[], percentile: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((percentile / 100) * sorted.length));
  return sorted[index] ?? 0;
}

function computeHeatmap(days: MonthAggregateResult['days']): Record<string, DayHeatMeta> {
  const expenses = Object.values(days).map((item) => item.expenseTotal).filter((value) => value > 0);
  if (!expenses.length) return {};
  const threshold = computePercentileThreshold(expenses, 80) || Math.max(...expenses);
  const result: Record<string, DayHeatMeta> = {};
  Object.values(days).forEach((item) => {
    if (item.expenseTotal <= 0) return;
    const ratio = threshold > 0 ? item.expenseTotal / threshold : 0;
    let level = 0;
    if (ratio >= 1.0) {
      level = 5;
    } else if (ratio >= 0.75) {
      level = 4;
    } else if (ratio >= 0.5) {
      level = 3;
    } else if (ratio >= 0.25) {
      level = 2;
    } else if (ratio > 0) {
      level = 1;
    }
    result[item.date] = { value: item.expenseTotal, level };
  });
  return result;
}

function buildQueryKey(month: Date, filters: CalendarFilters) {
  const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
  const normalizedFilters = {
    ...filters,
    categories: [...filters.categories].sort(),
    accountIds: [...filters.accountIds].sort(),
  };
  return ['calendar', 'aggregates', monthKey, normalizedFilters] as const;
}

export function useMonthAggregates({ month, filters }: UseMonthAggregatesOptions): UseMonthAggregatesResult {
  const monthStart = useMemo(() => startOfMonth(month), [month]);
  const monthEnd = useMemo(() => endOfMonth(month), [month]);

  const query = useQuery({
    queryKey: buildQueryKey(monthStart, filters),
    queryFn: () => fetchMonthAggregates({ monthStart, monthEnd, filters }),
    staleTime: 90 * 1000,
  });

  const heatmap = useMemo(() => {
    if (!query.data) return {};
    return computeHeatmap(query.data.days);
  }, [query.data]);

  return {
    data: query.data,
    heatmap,
    isLoading: query.isLoading,
    refetch: () => {
      void query.refetch();
    },
  };
}
