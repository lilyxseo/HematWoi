import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fetchDayTransactions, type CalendarFilters } from '../lib/calendarApi';

export interface UseDayTransactionsOptions {
  date: Date | null;
  filters: CalendarFilters;
  enabled?: boolean;
}

export function useDayTransactions({ date, filters, enabled = true }: UseDayTransactionsOptions) {
  const filterKey = JSON.stringify({
    ...filters,
    categories: [...filters.categories].sort(),
    accountIds: [...filters.accountIds].sort(),
  });
  return useQuery({
    queryKey: ['calendar', 'day', date ? format(date, 'yyyy-MM-dd') : 'none', filterKey],
    queryFn: () => {
      if (!date) {
        return Promise.resolve({ date: '', transactions: [] });
      }
      return fetchDayTransactions({ date, filters });
    },
    enabled: Boolean(date) && enabled,
    staleTime: 90 * 1000,
  });
}
