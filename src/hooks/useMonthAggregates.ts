import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CalendarFilters,
  MonthAggregatesResult,
  fetchMonthAggregates,
  normalizeFiltersInput,
  serializeFiltersKey,
} from '../lib/calendarApi';

interface UseMonthAggregatesParams {
  userId?: string | null;
  month: Date;
  filters: CalendarFilters;
}

export default function useMonthAggregates({ userId, month, filters }: UseMonthAggregatesParams) {
  const normalizedFilters = useMemo(() => normalizeFiltersInput(filters), [filters]);
  const monthKey = useMemo(() => format(month, 'yyyy-MM'), [month]);
  const filtersKey = useMemo(() => serializeFiltersKey(normalizedFilters), [normalizedFilters]);

  const query = useQuery<MonthAggregatesResult>({
    queryKey: ['calendar-month', userId ?? 'anonymous', monthKey, filtersKey],
    enabled: Boolean(userId),
    queryFn: () => fetchMonthAggregates({ userId: userId as string, month, filters: normalizedFilters }),
    staleTime: 90 * 1000,
  });

  return {
    ...query,
    filters: normalizedFilters,
  };
}

export type UseMonthAggregatesResult = ReturnType<typeof useMonthAggregates>;
