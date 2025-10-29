import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatISO } from 'date-fns';
import {
  fetchDayTransactions,
  normalizeCalendarFilters,
  type CalendarFilters,
  type DayTransactionRow,
} from '../lib/calendarApi';

type UseDayTransactionsOptions = {
  date: Date | null;
  filters: CalendarFilters;
  enabled?: boolean;
};

export default function useDayTransactions({
  date,
  filters,
  enabled = true,
}: UseDayTransactionsOptions) {
  const normalizedFilters = useMemo(
    () => normalizeCalendarFilters(filters),
    [filters],
  );

  const dateKey = useMemo(() => {
    if (!date) return null;
    return formatISO(date, { representation: 'date' });
  }, [date]);

  return useQuery<DayTransactionRow[]>({
    queryKey: ['calendar', 'day', dateKey, normalizedFilters],
    enabled: Boolean(enabled && dateKey),
    queryFn: async () => {
      if (!dateKey) return [];
      return fetchDayTransactions({ date: dateKey, filters: normalizedFilters });
    },
  });
}
