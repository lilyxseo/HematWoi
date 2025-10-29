import { useMemo } from 'react';
import { format, parseISO, startOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDayTransactions,
  type CalendarFilter,
  type DayTransactionsResponse,
  type FetchDayTransactionsParams,
  normalizeCalendarFilter,
  serializeCalendarFilter,
} from '../lib/calendarApi';

export type CalendarDayTransaction = {
  id: string;
  type: string;
  amount: number;
  categoryId: string | null;
  accountId: string | null;
  note: string | null;
  merchant: string | null;
  receiptUrl: string | null;
  transactionDate: string | null;
  timeLabel: string | null;
};

export type UseDayTransactionsResult = {
  dateKey: string | null;
  transactions: CalendarDayTransaction[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

function toISOStart(date: Date): string {
  return startOfDay(date).toISOString();
}

function resolveDate(row: DayTransactionsResponse[number]): string | null {
  return (row.transaction_date as string | null) ?? (row.date as string | null) ?? (row.created_at ?? null);
}

function resolveTimeLabel(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return format(parsed, 'HH:mm');
  } catch {
    return null;
  }
}

function resolveNote(row: DayTransactionsResponse[number]): string | null {
  const candidates = [row.notes, row.note, row.title];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  const fallback = (row as Record<string, unknown>).merchant_name;
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback.trim();
  }
  return null;
}

function resolveMerchant(row: DayTransactionsResponse[number]): string | null {
  if (row.merchant && typeof row.merchant === 'object') {
    if (typeof row.merchant.name === 'string' && row.merchant.name.trim()) {
      return row.merchant.name.trim();
    }
  }
  const candidates = [
    (row as Record<string, unknown>).merchant_name,
    (row as Record<string, unknown>).merchant,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function normalizeDayTransactions(rows: DayTransactionsResponse): CalendarDayTransaction[] {
  return rows.map((row) => {
    const transactionDate = resolveDate(row);
    return {
      id: String(row.id),
      type: typeof row.type === 'string' ? row.type : 'expense',
      amount: Number(row.amount) || 0,
      categoryId: row.category_id ? String(row.category_id) : null,
      accountId: row.account_id ? String(row.account_id) : null,
      note: resolveNote(row),
      merchant: resolveMerchant(row),
      receiptUrl: row.receipt_url ?? null,
      transactionDate,
      timeLabel: resolveTimeLabel(transactionDate),
    } satisfies CalendarDayTransaction;
  });
}

export default function useDayTransactions(
  date: Date | null,
  filters: CalendarFilter,
): UseDayTransactionsResult {
  const normalizedFilter = useMemo(() => normalizeCalendarFilter(filters), [filters]);
  const filterKey = useMemo(() => serializeCalendarFilter(normalizedFilter), [normalizedFilter]);
  const dateKey = useMemo(() => (date ? format(date, 'yyyy-MM-dd') : null), [date]);

  const params: FetchDayTransactionsParams | null = useMemo(() => {
    if (!date) return null;
    return {
      date: toISOStart(date),
      filters: normalizedFilter,
    } satisfies FetchDayTransactionsParams;
  }, [date, normalizedFilter]);

  const query = useQuery({
    queryKey: ['calendar', 'day', dateKey, filterKey],
    queryFn: () => fetchDayTransactions(params as FetchDayTransactionsParams),
    enabled: Boolean(params && dateKey),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const transactions = useMemo(() => {
    if (!query.data) return [] as CalendarDayTransaction[];
    return normalizeDayTransactions(query.data);
  }, [query.data]);

  return {
    dateKey,
    transactions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: async () => {
      await query.refetch();
    },
  };
}
