import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  addMonths,
  endOfMonth,
  formatISO,
  startOfMonth,
} from 'date-fns';
import {
  fetchMonthTransactions,
  normalizeCalendarFilters,
  type CalendarFilters,
  type MonthTransactionRow,
} from '../lib/calendarApi';

export interface DayAggregate {
  date: string;
  expense: number;
  income: number;
  count: number;
}

export interface MonthAggregatesData {
  days: Record<string, DayAggregate>;
  expenseTotal: number;
  incomeTotal: number;
  netTotal: number;
  maxExpense: number;
  p80Expense: number;
  p95Expense: number;
  previousExpenseTotal: number;
  previousIncomeTotal: number;
}

type UseMonthAggregatesOptions = {
  month: Date;
  filters: CalendarFilters;
};

function createQueryKey(month: Date, filters: CalendarFilters) {
  const key = `${month.getUTCFullYear()}-${String(
    month.getUTCMonth() + 1,
  ).padStart(2, '0')}`;
  return ['calendar', 'month', key, filters] as const;
}

function summarize(rows: MonthTransactionRow[]): MonthAggregatesData {
  const dayMap = new Map<string, DayAggregate>();
  let expenseTotal = 0;
  let incomeTotal = 0;

  for (const row of rows) {
    if (!row.date) continue;
    const key = row.date.slice(0, 10);
    const type = row.type;
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount)) continue;

    if (!dayMap.has(key)) {
      dayMap.set(key, {
        date: key,
        expense: 0,
        income: 0,
        count: 0,
      });
    }
    const aggregate = dayMap.get(key)!;
    aggregate.count += 1;
    if (type === 'expense') {
      aggregate.expense += amount;
      expenseTotal += amount;
    } else if (type === 'income') {
      aggregate.income += amount;
      incomeTotal += amount;
    }
  }

  const expenses = Array.from(dayMap.values())
    .map((item) => item.expense)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const maxExpense = expenses.length ? expenses[expenses.length - 1] : 0;
  const getPercentile = (p: number) => {
    if (!expenses.length) return 0;
    const index = Math.min(
      expenses.length - 1,
      Math.max(0, Math.round((expenses.length - 1) * p)),
    );
    return expenses[index] ?? 0;
  };

  const p80Expense = getPercentile(0.8);
  const p95Expense = getPercentile(0.95);

  return {
    days: Object.fromEntries(dayMap),
    expenseTotal,
    incomeTotal,
    netTotal: incomeTotal - expenseTotal,
    maxExpense,
    p80Expense,
    p95Expense,
    previousExpenseTotal: 0,
    previousIncomeTotal: 0,
  };
}

function attachPrevious(
  current: MonthAggregatesData,
  previousRows: MonthTransactionRow[],
): MonthAggregatesData {
  let prevExpense = 0;
  let prevIncome = 0;
  for (const row of previousRows) {
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    if (row.type === 'expense') {
      prevExpense += amount;
    } else if (row.type === 'income') {
      prevIncome += amount;
    }
  }
  return {
    ...current,
    previousExpenseTotal: prevExpense,
    previousIncomeTotal: prevIncome,
  };
}

export default function useMonthAggregates({
  month,
  filters,
}: UseMonthAggregatesOptions) {
  const normalizedFilters = useMemo(
    () => normalizeCalendarFilters(filters),
    [filters],
  );
  const queryKey = useMemo(
    () => createQueryKey(month, normalizedFilters),
    [month, normalizedFilters],
  );

  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const prevStart = startOfMonth(addMonths(month, -1));
  const prevEnd = endOfMonth(addMonths(month, -1));

  const startStr = formatISO(start, { representation: 'date' });
  const endStr = formatISO(end, { representation: 'date' });
  const prevStartStr = formatISO(prevStart, { representation: 'date' });
  const prevEndStr = formatISO(prevEnd, { representation: 'date' });

  return useQuery({
    queryKey,
    queryFn: async () => {
      const [currentRows, previousRows] = await Promise.all([
        fetchMonthTransactions({
          startDate: startStr,
          endDate: endStr,
          filters: normalizedFilters,
        }),
        fetchMonthTransactions({
          startDate: prevStartStr,
          endDate: prevEndStr,
          filters: normalizedFilters,
        }),
      ]);
      const current = summarize(currentRows);
      return attachPrevious(current, previousRows);
    },
  });
}
