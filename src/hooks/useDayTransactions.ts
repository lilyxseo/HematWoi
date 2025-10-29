import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDayTransactions,
  type CalendarFilters,
  type CalendarTransaction,
} from "../lib/calendarApi";

export interface UseDayTransactionsResult {
  transactions: CalendarTransaction[];
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

export default function useDayTransactions(
  date: string | null,
  filters: CalendarFilters,
): UseDayTransactionsResult {
  const filtersKey = useMemo(
    () => ({
      includeIncome: filters.includeIncome,
      categories: [...filters.categories].sort(),
      accounts: [...filters.accounts].sort(),
      amountMin: filters.amountMin ?? null,
      amountMax: filters.amountMax ?? null,
      search: filters.search ?? "",
    }),
    [filters],
  );

  const query = useQuery({
    queryKey: ["calendar", "day", date, filtersKey],
    queryFn: ({ signal }) => {
      if (!date) {
        return Promise.resolve([] as CalendarTransaction[]);
      }
      return fetchDayTransactions({ date, filters, signal });
    },
    enabled: Boolean(date),
    keepPreviousData: true,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
  });

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
