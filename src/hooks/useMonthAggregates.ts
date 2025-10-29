import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import {
  CalendarFilters,
  DayAggregate,
  MonthAggregatesResponse,
  fetchMonthAggregates,
} from '../lib/calendarApi';

export type DaySummary = DayAggregate & {
  dateObj: Date;
};

export type UseMonthAggregatesResult = {
  data: MonthAggregatesResponse | undefined;
  days: DaySummary[];
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<MonthAggregatesResponse | undefined>;
  monthLabel: string;
  monthKey: string;
  currentMonth: Date;
  previousMonth: Date;
};

function serializeFilters(filters: CalendarFilters): string {
  return JSON.stringify({
    includeIncome: filters.includeIncome,
    categories: [...filters.categories].sort(),
    accountId: filters.accountId ?? null,
    amountMin: Number.isFinite(filters.amountMin ?? NaN)
      ? Number(filters.amountMin)
      : null,
    amountMax: Number.isFinite(filters.amountMax ?? NaN)
      ? Number(filters.amountMax)
      : null,
    search: (filters.search ?? '').trim(),
  });
}

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function useMonthAggregates(month: Date, filters: CalendarFilters): UseMonthAggregatesResult {
  const currentMonth = useMemo(() => startOfMonth(month), [month]);
  const monthKey = useMemo(() => format(currentMonth, 'yyyy-MM'), [currentMonth]);
  const previousMonth = useMemo(() => subMonths(currentMonth, 1), [currentMonth]);

  const filterKey = useMemo(() => serializeFilters(filters), [filters]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['calendar', 'aggregates', monthKey, filterKey],
    queryFn: async () => {
      const startDate = formatDate(currentMonth);
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const previousStart = formatDate(previousMonth);
      const previousEnd = format(endOfMonth(previousMonth), 'yyyy-MM-dd');
      return await fetchMonthAggregates({
        startDate,
        endDate,
        previousStart,
        previousEnd,
        filters,
      });
    },
    staleTime: 60 * 1000,
    keepPreviousData: true,
  });

  const days = useMemo<DaySummary[]>(() => {
    if (!data) return [];
    return Object.values(data.dayMap)
      .map((item) => ({
        ...item,
        dateObj: new Date(item.date),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const monthLabel = useMemo(() => format(currentMonth, 'MMMM yyyy', { locale: undefined }), [currentMonth]);

  return {
    data,
    days,
    isLoading,
    isFetching,
    refetch: async () => {
      const result = await refetch();
      return result.data;
    },
    monthLabel,
    monthKey,
    currentMonth,
    previousMonth,
  };
}
