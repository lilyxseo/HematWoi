import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDayTransactions,
  type CalendarItemRow,
  type NormalizedCalendarFilters,
} from '../lib/calendarApi';
import { serializeCalendarFilters } from './useMonthAggregates';

export function useDayTransactions(
  date: string | null,
  filters: NormalizedCalendarFilters,
  enabled: boolean,
) {
  const dayKey = date ? date.slice(0, 10) : null;
  const filterKey = useMemo(() => serializeCalendarFilters(filters), [filters]);

  return useQuery<CalendarItemRow[]>({
    queryKey: ['calendar-day', dayKey, filterKey],
    queryFn: () => {
      if (!dayKey) return [];
      return fetchDayTransactions(dayKey, filters);
    },
    enabled: Boolean(dayKey) && enabled,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });
}
