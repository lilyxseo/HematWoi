import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CalendarFilters,
  DayTransactionsResult,
  fetchDayTransactions,
  normalizeFiltersInput,
  serializeFiltersKey,
} from '../lib/calendarApi';

interface UseDayTransactionsParams {
  userId?: string | null;
  date?: Date | null;
  filters: CalendarFilters;
  enabled?: boolean;
}

export default function useDayTransactions({
  userId,
  date,
  filters,
  enabled = true,
}: UseDayTransactionsParams) {
  const normalizedFilters = useMemo(() => normalizeFiltersInput(filters), [filters]);
  const dateKey = useMemo(() => (date ? format(date, 'yyyy-MM-dd') : null), [date]);
  const filtersKey = useMemo(() => serializeFiltersKey(normalizedFilters), [normalizedFilters]);

  const query = useQuery<DayTransactionsResult>({
    queryKey: ['calendar-day', userId ?? 'anonymous', dateKey ?? 'none', filtersKey],
    enabled: Boolean(userId && dateKey && enabled),
    queryFn: () =>
      fetchDayTransactions({
        userId: userId as string,
        date: dateKey as string,
        filters: normalizedFilters,
      }),
    staleTime: 90 * 1000,
  });

  return {
    ...query,
    filters: normalizedFilters,
  };
}

export type UseDayTransactionsResult = ReturnType<typeof useDayTransactions>;
