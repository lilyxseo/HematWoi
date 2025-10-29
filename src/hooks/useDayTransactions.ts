import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDayTransactions,
  type CalendarFilterState,
  type CalendarTransaction,
} from '../lib/calendarApi';

export type DayTransactionsResult = {
  transactions: CalendarTransaction[];
  totals: {
    expense: number;
    income: number;
    net: number;
  };
};

function serializeFilters(filters: CalendarFilterState): string {
  const categories = [...filters.categories].sort().join(',');
  const accounts = [...filters.accounts].sort().join(',');
  const min = filters.minAmount ?? '';
  const max = filters.maxAmount ?? '';
  const search = filters.search.trim().toLowerCase();
  return `${filters.mode}|${categories}|${accounts}|${min}|${max}|${search}`;
}

export default function useDayTransactions(
  date: string | null,
  filters: CalendarFilterState,
) {
  const filtersKey = useMemo(
    () => serializeFilters(filters),
    [
      filters.mode,
      filters.search,
      filters.minAmount,
      filters.maxAmount,
      filters.categories.join(','),
      filters.accounts.join(','),
    ],
  );

  return useQuery<DayTransactionsResult>({
    queryKey: ['calendar-day', date, filtersKey],
    enabled: Boolean(date),
    queryFn: async ({ signal }) => {
      if (!date) {
        return { transactions: [], totals: { expense: 0, income: 0, net: 0 } };
      }
      const rows = await fetchDayTransactions({ date, filters, signal });
      const expense = rows
        .filter((item) => item.type === 'expense')
        .reduce((total, item) => total + Math.max(0, Number(item.amount ?? 0)), 0);
      const income = rows
        .filter((item) => item.type === 'income')
        .reduce((total, item) => total + Math.max(0, Number(item.amount ?? 0)), 0);
      return {
        transactions: rows,
        totals: {
          expense,
          income,
          net: income - expense,
        },
      } satisfies DayTransactionsResult;
    },
    staleTime: 30 * 1000,
    keepPreviousData: true,
  });
}
