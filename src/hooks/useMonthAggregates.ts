import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMonthTransactions,
  type CalendarFilters,
  type CalendarTransaction,
} from "../lib/calendarApi";

export interface DayAggregate {
  date: string;
  expenseTotal: number;
  incomeTotal: number;
  transactionCount: number;
  heatClass: string;
  intensity: number;
}

export interface UseMonthAggregatesResult {
  daySummaries: Record<string, DayAggregate>;
  monthExpense: number;
  monthIncome: number;
  monthNet: number;
  previousExpense: number;
  previousIncome: number;
  momExpenseChange: number | null;
  momIncomeChange: number | null;
  monthDate: Date;
  daysInMonth: number;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

function getNowMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function parseMonthKey(monthKey: string | null | undefined) {
  if (!monthKey) {
    return getNowMonth();
  }
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) {
    return getNowMonth();
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return getNowMonth();
  }
  return { year, month };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function computePercentile(values: number[], percentile: number): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * percentile)),
  );
  return sorted[index];
}

function resolveHeatClass(expense: number, reference: number, p95: number): string {
  if (expense <= 0) {
    return "bg-slate-950";
  }
  if (reference <= 0) {
    return "bg-slate-900";
  }
  if (p95 > 0 && expense >= p95) {
    return "bg-rose-900/70";
  }
  const ratio = Math.min(1, expense / reference);
  if (ratio >= 0.75) {
    return "bg-rose-900/50";
  }
  if (ratio >= 0.5) {
    return "bg-rose-900/30";
  }
  if (ratio >= 0.25) {
    return "bg-slate-900/80";
  }
  return "bg-slate-900";
}

function computeMoM(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }
  if (previous === 0) {
    if (current === 0) {
      return 0;
    }
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function summariseMonth(
  monthKey: string,
  daysInMonth: number,
  transactions: CalendarTransaction[],
  previousExpense: number,
  previousIncome: number,
): Omit<UseMonthAggregatesResult, "isLoading" | "isFetching" | "refetch" | "monthDate" | "daysInMonth"> {
  const daySummaries: Record<string, DayAggregate> = {};
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = formatDateKey(year, month, day);
    daySummaries[key] = {
      date: key,
      expenseTotal: 0,
      incomeTotal: 0,
      transactionCount: 0,
      heatClass: "bg-slate-950",
      intensity: 0,
    };
  }

  let monthExpense = 0;
  let monthIncome = 0;

  transactions.forEach((transaction) => {
    const dateKey = String(transaction.transaction_date).slice(0, 10);
    const summary = daySummaries[dateKey];
    if (!summary) {
      return;
    }
    const amount = Math.abs(Number(transaction.amount) || 0);
    if (transaction.type === "expense") {
      summary.expenseTotal += amount;
      monthExpense += amount;
    } else if (transaction.type === "income") {
      summary.incomeTotal += amount;
      monthIncome += amount;
    }
    summary.transactionCount += 1;
  });

  const expenseValues = Object.values(daySummaries)
    .map((item) => item.expenseTotal)
    .filter((value) => value > 0);
  const p80 = computePercentile(expenseValues, 0.8);
  const p95 = computePercentile(expenseValues, 0.95);
  const reference =
    p95 > 0
      ? p95
      : p80 > 0
        ? p80
        : expenseValues.length
          ? Math.max(...expenseValues)
          : 0;

  Object.values(daySummaries).forEach((item) => {
    item.heatClass = resolveHeatClass(item.expenseTotal, reference, p95);
    item.intensity = reference > 0 ? Math.min(1, item.expenseTotal / reference) : 0;
  });

  const monthNet = monthIncome - monthExpense;
  const momExpenseChange = computeMoM(monthExpense, previousExpense);
  const momIncomeChange = computeMoM(monthIncome, previousIncome);

  return {
    daySummaries,
    monthExpense,
    monthIncome,
    monthNet,
    previousExpense,
    previousIncome,
    momExpenseChange,
    momIncomeChange,
  };
}

export default function useMonthAggregates(
  monthKey: string,
  filters: CalendarFilters,
): UseMonthAggregatesResult {
  const { year, month } = useMemo(() => parseMonthKey(monthKey), [monthKey]);
  const resolvedMonthKey = `${year}-${pad(month)}`;
  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousDays = getDaysInMonth(previousYear, previousMonth);

  const range = useMemo(
    () => ({
      start: `${year}-${pad(month)}-01`,
      end: `${year}-${pad(month)}-${pad(daysInMonth)}`,
      previousStart: `${previousYear}-${pad(previousMonth)}-01`,
      previousEnd: `${previousYear}-${pad(previousMonth)}-${pad(previousDays)}`,
    }),
    [year, month, daysInMonth, previousYear, previousMonth, previousDays],
  );

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
    queryKey: ["calendar", "month", resolvedMonthKey, filtersKey],
    queryFn: ({ signal }) =>
      fetchMonthTransactions({
        startDate: range.start,
        endDate: range.end,
        previousStartDate: range.previousStart,
        previousEndDate: range.previousEnd,
        filters,
        signal,
      }),
    keepPreviousData: true,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const monthDate = useMemo(() => new Date(year, month - 1, 1), [year, month]);

  const summary = useMemo(() => {
    if (!query.data) {
      return {
        daySummaries: {} as Record<string, DayAggregate>,
        monthExpense: 0,
        monthIncome: 0,
        monthNet: 0,
        previousExpense: 0,
        previousIncome: 0,
        momExpenseChange: null,
        momIncomeChange: null,
      };
    }
    return summariseMonth(
      resolvedMonthKey,
      daysInMonth,
      query.data.transactions,
      query.data.previousExpenseTotal,
      query.data.previousIncomeTotal,
    );
  }, [query.data, resolvedMonthKey, daysInMonth]);

  return {
    daySummaries: summary.daySummaries,
    monthExpense: summary.monthExpense,
    monthIncome: summary.monthIncome,
    monthNet: summary.monthNet,
    previousExpense: summary.previousExpense,
    previousIncome: summary.previousIncome,
    momExpenseChange: summary.momExpenseChange,
    momIncomeChange: summary.momIncomeChange,
    monthDate,
    daysInMonth,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
