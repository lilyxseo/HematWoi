import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  fetchMonthAggregates,
  type MonthAggregatesData,
  type NormalizedCalendarFilters,
} from '../lib/calendarApi';

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

  return useQuery<MonthAggregatesData>({
    queryKey: ['calendar-month', monthKey, filterKey],
    queryFn: () => fetchMonthAggregates(month, filters),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    keepPreviousData: true,
  });
}
