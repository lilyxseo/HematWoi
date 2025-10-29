import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import {
  type CalendarFilters,
  type CalendarMonthRow,
  fetchMonthRows,
} from '../lib/calendarApi';

export type DaySummary = {
  date: string;
  expenseTotal: number;
  incomeTotal: number;
  transactionCount: number;
};

export type MonthSummary = {
  totalExpense: number;
  totalIncome: number;
  net: number;
  expenseChangePct: number | null;
  incomeChangePct: number | null;
  netChangePct: number | null;
  previousExpense: number;
  previousIncome: number;
  previousNet: number;
};

export type UseMonthAggregatesResult = {
  monthKey: string;
  days: Record<string, DaySummary>;
  expenseValues: number[];
  summary: MonthSummary;
  getHeatmapClass: (value: number) => string;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
};

function toMonthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

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

function computeQuantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function computeChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function normalizeSearch(search?: string): string {
  return search ? search.trim().toLowerCase() : '';
}

function matchesSearch(
  row: CalendarMonthRow,
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

function aggregateRows(
  rows: CalendarMonthRow[] | undefined,
  search: string,
  merchantLookup?: Map<string, string>,
) {
  const days = new Map<string, DaySummary>();
  let totalExpense = 0;
  let totalIncome = 0;
  const expenseValues: number[] = [];

  if (rows) {
    for (const row of rows) {
      if (!row?.transaction_date) continue;
      if (!matchesSearch(row, search, merchantLookup)) continue;
      const dateKey = row.transaction_date.slice(0, 10);
      if (!dateKey) continue;
      const entry = days.get(dateKey) ?? {
        date: dateKey,
        expenseTotal: 0,
        incomeTotal: 0,
        transactionCount: 0,
      };
      const amount = Math.abs(Number(row.amount) || 0);
      if (row.type === 'expense') {
        entry.expenseTotal += amount;
        totalExpense += amount;
      } else if (row.type === 'income') {
        entry.incomeTotal += amount;
        totalIncome += amount;
      }
      entry.transactionCount += 1;
      days.set(dateKey, entry);
    }
  }

  for (const entry of days.values()) {
    if (entry.expenseTotal > 0) {
      expenseValues.push(entry.expenseTotal);
    }
  }

  return {
    days,
    expenseValues,
    totalExpense,
    totalIncome,
  };
}

function buildHeatmapClassifier(expenseValues: number[]) {
  if (!expenseValues.length) {
    return () => 'bg-slate-900/60';
  }
  const p80 = computeQuantile(expenseValues, 0.8);
  const p95 = computeQuantile(expenseValues, 0.95);
  const max = Math.max(...expenseValues);
  const base = p95 || max || 0;

  return (value: number) => {
    const amount = Math.abs(value || 0);
    if (!amount) return 'bg-slate-900/60';
    if (!base) return 'bg-rose-900/30';
    if (p95 && amount > p95) return 'bg-rose-900/70';
    const ratio = amount / base;
    if (ratio <= 0.25) return 'bg-slate-900';
    if (ratio <= 0.5) return 'bg-slate-900/80';
    if (ratio <= 0.75) return 'bg-rose-900/30';
    return 'bg-rose-900/50';
  };
}

export default function useMonthAggregates(
  month: Date,
  filters: CalendarFilters,
  merchantLookup?: Map<string, string>,
): UseMonthAggregatesResult {
  const monthKey = useMemo(() => toMonthKey(month), [month]);
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);
  const search = useMemo(() => normalizeSearch(filters.search), [filters.search]);
  const start = useMemo(() => format(startOfMonth(month), 'yyyy-MM-dd'), [month]);
  const end = useMemo(() => format(endOfMonth(month), 'yyyy-MM-dd'), [month]);

  const monthQuery = useQuery({
    queryKey: ['calendar', 'month', monthKey, normalizedFilters],
    queryFn: ({ signal }) => fetchMonthRows(start, end, normalizedFilters, signal),
    staleTime: 60 * 1000,
  });

  const previousMonth = useMemo(() => subMonths(month, 1), [month]);
  const previousStart = useMemo(
    () => format(startOfMonth(previousMonth), 'yyyy-MM-dd'),
    [previousMonth],
  );
  const previousEnd = useMemo(
    () => format(endOfMonth(previousMonth), 'yyyy-MM-dd'),
    [previousMonth],
  );
  const previousKey = useMemo(() => toMonthKey(previousMonth), [previousMonth]);

  const previousQuery = useQuery({
    queryKey: ['calendar', 'month', previousKey, normalizedFilters],
    queryFn: ({ signal }) => fetchMonthRows(previousStart, previousEnd, normalizedFilters, signal),
    staleTime: 60 * 1000,
  });

  const aggregated = useMemo(() => {
    return aggregateRows(monthQuery.data, search, merchantLookup);
  }, [monthQuery.data, search, merchantLookup]);

  const previousAggregated = useMemo(() => {
    return aggregateRows(previousQuery.data, search, merchantLookup);
  }, [previousQuery.data, search, merchantLookup]);

  const heatmapClass = useMemo(
    () => buildHeatmapClassifier(aggregated.expenseValues),
    [aggregated.expenseValues],
  );

  const summary = useMemo<MonthSummary>(() => {
    const totalExpense = aggregated.totalExpense;
    const totalIncome = aggregated.totalIncome;
    const net = totalIncome - totalExpense;
    const previousExpense = previousAggregated.totalExpense;
    const previousIncome = previousAggregated.totalIncome;
    const previousNet = previousIncome - previousExpense;

    return {
      totalExpense,
      totalIncome,
      net,
      previousExpense,
      previousIncome,
      previousNet,
      expenseChangePct: computeChange(totalExpense, previousExpense),
      incomeChangePct: computeChange(totalIncome, previousIncome),
      netChangePct: computeChange(net, previousNet),
    };
  }, [aggregated, previousAggregated]);

  return {
    monthKey,
    days: Object.fromEntries(aggregated.days),
    expenseValues: aggregated.expenseValues,
    summary,
    getHeatmapClass: heatmapClass,
    isLoading: monthQuery.isLoading,
    isFetching: monthQuery.isFetching,
    error: monthQuery.error,
    refetch: () => monthQuery.refetch(),
  };
}
