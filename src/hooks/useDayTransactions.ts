import { useQuery } from '@tanstack/react-query';
import { CalendarFilters, CalendarTransaction, fetchDayTransactions, serializeFilters } from '../lib/calendarApi';

export function useDayTransactions(date: string | null, filters: CalendarFilters) {
  const normalizedDate = date ? String(date).slice(0, 10) : null;
  const filterKey = serializeFilters(filters);

  return useQuery<CalendarTransaction[]>({
    queryKey: ['calendar', 'day', normalizedDate, filterKey],
    queryFn: () => fetchDayTransactions({ date: normalizedDate!, filters }),
    enabled: Boolean(normalizedDate),
    staleTime: 60 * 1000,
  });
}
