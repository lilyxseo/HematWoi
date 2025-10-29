import { useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type CalendarDayTransaction,
  type CalendarFilters,
  fetchDayRows,
} from '../lib/calendarApi';
import { removeTransaction } from '../lib/api-transactions';

export type DayTotals = {
  totalExpense: number;
  totalIncome: number;
};

export type UseDayTransactionsResult = {
  transactions: CalendarDayTransaction[];
  totals: DayTotals;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
  deleteTransaction: (id: string) => Promise<boolean>;
  deletingId: string | null;
};

function normalizeFilters(filters: CalendarFilters) {
  return {
    mode: filters.mode,
    categoryIds: [...filters.categoryIds].sort(),
    accountIds: [...filters.accountIds].sort(),
    minAmount:
      typeof filters.minAmount === 'number' && Number.isFinite(filters.minAmount)
        ? filters.minAmount
        : null,
    maxAmount:
      typeof filters.maxAmount === 'number' && Number.isFinite(filters.maxAmount)
        ? filters.maxAmount
        : null,
  };
}

function normalizeSearch(search?: string): string {
  return search ? search.trim().toLowerCase() : '';
}

function matchesSearch(
  row: CalendarDayTransaction,
  search: string,
  merchantLookup?: Map<string, string>,
): boolean {
  if (!search) return true;
  const note = row.note ? row.note.toLowerCase() : '';
  if (note.includes(search)) return true;
  if (!merchantLookup) return false;
  const merchantName = row.merchant_id
    ? merchantLookup.get(row.merchant_id)?.toLowerCase() ?? ''
    : '';
  return merchantName.includes(search);
}

function sortByTimestamp(a: CalendarDayTransaction, b: CalendarDayTransaction) {
  const aTime = a.transaction_date || '';
  const bTime = b.transaction_date || '';
  if (aTime === bTime) {
    return (a.created_at || '').localeCompare(b.created_at || '');
  }
  return aTime.localeCompare(bTime);
}

export default function useDayTransactions(
  date: string | null,
  filters: CalendarFilters,
  merchantLookup?: Map<string, string>,
): UseDayTransactionsResult {
  const queryClient = useQueryClient();
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);
  const search = useMemo(() => normalizeSearch(filters.search), [filters.search]);

  const query = useQuery({
    queryKey: ['calendar', 'day', date, normalizedFilters],
    queryFn: ({ signal }) => fetchDayRows(date as string, normalizedFilters, signal),
    enabled: Boolean(date),
    staleTime: 30 * 1000,
  });

  const filteredTransactions = useMemo(() => {
    if (!query.data) return [] as CalendarDayTransaction[];
    return query.data
      .filter((row) => matchesSearch(row, search, merchantLookup))
      .sort(sortByTimestamp);
  }, [query.data, search, merchantLookup]);

  const totals = useMemo(() => {
    let totalExpense = 0;
    let totalIncome = 0;
    for (const row of filteredTransactions) {
      const amount = Math.abs(Number(row.amount) || 0);
      if (row.type === 'expense') {
        totalExpense += amount;
      } else if (row.type === 'income') {
        totalIncome += amount;
      }
    }
    return { totalExpense, totalIncome };
  }, [filteredTransactions]);

  const mutation = useMutation({
    mutationFn: async (id: string) => removeTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'day'] });
      queryClient.invalidateQueries({ queryKey: ['calendar', 'month'] });
    },
  });

  return {
    transactions: filteredTransactions,
    totals,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => query.refetch(),
    deleteTransaction: async (id: string) => mutation.mutateAsync(id),
    deletingId:
      mutation.variables != null ? String(mutation.variables) : null,
  };
}
