import { useQuery } from '@tanstack/react-query';
import { CalendarFilters, CalendarTransaction, fetchDayTransactions } from '../lib/calendarApi';

export function useDayTransactions(
  date: string | null,
  filters: CalendarFilters,
  enabled: boolean,
) {
  return useQuery<CalendarTransaction[]>({
    queryKey: ['calendar', 'day', date, JSON.stringify(filters)],
    queryFn: () => {
      if (!date) return Promise.resolve([]);
      return fetchDayTransactions({ date, filters });
    },
    enabled: Boolean(date) && enabled,
    staleTime: 30 * 1000,
    keepPreviousData: true,
  });
}
