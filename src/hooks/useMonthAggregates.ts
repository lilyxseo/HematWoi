import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  fetchMonthAggregates,
  type DaySummary,
  type MonthAggregatesData,
  type NormalizedCalendarFilters,
} from '../lib/calendarApi';

export interface MonthAggregatesResult extends MonthAggregatesData {
  expenseByDay: Record<string, number>;
  incomeByDay: Record<string, number>;
  countByDay: Record<string, number>;
}

function buildDayMaps(daySummaries: Record<string, DaySummary>) {
  const expenseByDay: Record<string, number> = {};
  const incomeByDay: Record<string, number> = {};
  const countByDay: Record<string, number> = {};

  for (const [key, summary] of Object.entries(daySummaries)) {
    expenseByDay[key] = summary?.expenseTotal ?? 0;
    incomeByDay[key] = summary?.incomeTotal ?? 0;
    countByDay[key] = summary?.count ?? 0;
  }

  return { expenseByDay, incomeByDay, countByDay };
}

export function serializeCalendarFilters(
  filters: NormalizedCalendarFilters,
): string {
  return [
    filters.type,
    filters.accountId ?? '',
    filters.minAmount ?? '',
    filters.maxAmount ?? '',
    filters.search ?? '',
    filters.categoryIds.join(','),
  ].join('|');
}

export function useMonthAggregates(
  month: Date,
  filters: NormalizedCalendarFilters,
) {
  const monthKey = useMemo(() => format(month, 'yyyy-MM'), [month]);
  const filterKey = useMemo(() => serializeCalendarFilters(filters), [filters]);

  return useQuery<MonthAggregatesData, Error, MonthAggregatesResult>({
    queryKey: ['calendar-month', monthKey, filterKey],
    queryFn: () => fetchMonthAggregates(month, filters),
    select: (data) => {
      const maps = buildDayMaps(data.daySummaries ?? {});
      return {
        ...data,
        ...maps,
      };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    keepPreviousData: true,
  });
}
