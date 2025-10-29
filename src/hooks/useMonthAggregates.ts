import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  fetchMonthAggregates,
  type MonthAggregatesData,
  type NormalizedCalendarFilters,
} from '../lib/calendarApi';

type MonthAggregatesResult = MonthAggregatesData & {
  expenseByDay: Map<string, number>;
  incomeByDay: Map<string, number>;
  countByDay: Map<string, number>;
};

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
      const expenseByDay = new Map<string, number>();
      const incomeByDay = new Map<string, number>();
      const countByDay = new Map<string, number>();

      for (const summary of Object.values(data.daySummaries)) {
        expenseByDay.set(summary.date, summary.expenseTotal ?? 0);
        incomeByDay.set(summary.date, summary.incomeTotal ?? 0);
        countByDay.set(summary.date, summary.count ?? 0);
      }

      return {
        ...data,
        expenseByDay,
        incomeByDay,
        countByDay,
      };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    keepPreviousData: true,
  });
}
