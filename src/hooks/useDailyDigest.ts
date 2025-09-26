import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { supabase } from "../lib/supabase";
import { getCurrentUserId } from "../lib/session";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "Asia/Jakarta";
const DATE_FORMAT = "YYYY-MM-DD";
const STORAGE_PREFIX = "hw_digest_seen";

export type TrendDirection = "up" | "down" | "flat";
export type BudgetStatus = "safe" | "warning" | "danger";

export interface DailyDigestBalance {
  total: number;
  previous: number;
  diff: number;
  changePercent: number | null;
  direction: TrendDirection;
}

export interface DailyDigestTodayInsight {
  expense: number;
  income: number;
  average: number;
  difference: number;
  differencePercent: number | null;
  direction: TrendDirection;
}

export interface DailyDigestBudgetCategory {
  id: string | null;
  name: string;
  planned: number;
  actual: number;
  pct: number;
  status: BudgetStatus;
}

export interface DailyDigestBudgetSummary {
  planned: number;
  spent: number;
  pct: number;
  status: BudgetStatus;
  categories: DailyDigestBudgetCategory[];
}

export interface DailyDigestTopCategory {
  id: string | null;
  name: string;
  amount: number;
  pct: number;
}

export interface DailyDigestUpcomingItem {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
  type: "subscription" | "debt";
}

export interface DailyDigestData {
  generatedAt: string;
  todayKey: string;
  balance: DailyDigestBalance;
  today: DailyDigestTodayInsight;
  budgets: DailyDigestBudgetSummary;
  topCategories: DailyDigestTopCategory[];
  upcoming: DailyDigestUpcomingItem[];
}

export interface UseDailyDigestResult {
  data: DailyDigestData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<DailyDigestData | undefined>;
  userId: string | null;
  todayKey: string;
}

type TransactionRow = {
  id?: string;
  type?: string | null;
  amount?: number | string | null;
  date?: string | null;
  category_id?: string | null;
  category?: { id?: string | null; name?: string | null } | null;
  category_name?: string | null;
  category_label?: string | null;
};

type AccountRow = {
  id?: string;
  balance?: number | string | null;
  is_archived?: boolean | null;
};

type BudgetRow = {
  id?: string;
  category_id?: string | null;
  name?: string | null;
  amount_planned?: number | string | null;
  planned?: number | string | null;
  period_month?: string | null;
  category?: { id?: string | null; name?: string | null } | null;
  category_name?: string | null;
};

type SubscriptionChargeRow = {
  id: string;
  amount?: number | string | null;
  due_date?: string | null;
  status?: string | null;
  subscription?: { id?: string | null; name?: string | null } | null;
};

type DebtRow = {
  id: string;
  title?: string | null;
  due_date?: string | null;
  amount?: number | string | null;
  status?: string | null;
};

function nowInTz() {
  return dayjs().tz(TIMEZONE);
}

function toDateString(value: dayjs.Dayjs) {
  return value.tz(TIMEZONE).format(DATE_FORMAT);
}

export function getDigestTodayKey(): string {
  return toDateString(nowInTz());
}

function getMonthRange(reference = nowInTz()) {
  const start = reference.startOf("month");
  const end = start.add(1, "month");
  return { start, end };
}

function getUpcomingRange(reference = nowInTz()) {
  const start = reference.startOf("day");
  const end = start.add(7, "day");
  return { start, end };
}

function toNumber(input: unknown): number {
  if (input == null) return 0;
  const parsed = typeof input === "string" ? Number.parseFloat(input) : Number(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeName(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length) {
      return value.trim();
    }
  }
  return "Tanpa kategori";
}

function getBudgetStatus(pct: number): BudgetStatus {
  if (!Number.isFinite(pct) || pct < 90) return "safe";
  if (pct >= 100) return "danger";
  return "warning";
}

async function fetchRows<T>(query: Promise<{ data: T | null; error: { message?: string } | null }>, scope: string): Promise<T>
{
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || `Gagal memuat ${scope}`);
  }
  return (data ?? ([] as unknown)) as T;
}

function computeTransactions(
  rows: TransactionRow[],
  todayKey: string,
): {
  monthExpense: number;
  todayExpense: number;
  todayIncome: number;
  categories: DailyDigestTopCategory[];
  spentByCategoryId: Map<string, number>;
} {
  let monthExpense = 0;
  let todayExpense = 0;
  let todayIncome = 0;

  const totals = new Map<string, { id: string | null; name: string; amount: number }>();
  const spentById = new Map<string, number>();

  for (const row of rows) {
    const type = row?.type ?? "";
    const amount = toNumber(row?.amount);
    if (amount <= 0) continue;

    const dateValue = typeof row?.date === "string" ? row.date.slice(0, 10) : "";
    const categoryId = row?.category_id ?? row?.category?.id ?? null;
    const name = normalizeName(row?.category?.name, row?.category_name, row?.category_label);

    if (type === "expense") {
      monthExpense += amount;
      if (dateValue === todayKey) {
        todayExpense += amount;
      }
      const key = categoryId ?? `no-${name}`;
      const current = totals.get(key) ?? { id: categoryId, name, amount: 0 };
      current.amount += amount;
      totals.set(key, current);
      if (categoryId) {
        spentById.set(categoryId, (spentById.get(categoryId) ?? 0) + amount);
      }
    } else if (type === "income") {
      if (dateValue === todayKey) {
        todayIncome += amount;
      }
    }
  }

  const categories: DailyDigestTopCategory[] = Array.from(totals.values())
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
      pct: 0,
    }));

  return { monthExpense, todayExpense, todayIncome, categories, spentByCategoryId: spentById };
}

function enrichTopCategories(categories: DailyDigestTopCategory[], totalExpense: number): DailyDigestTopCategory[] {
  if (totalExpense <= 0) {
    return categories.slice(0, 3).map((item) => ({ ...item, pct: 0 }));
  }
  return categories
    .map((item) => ({ ...item, pct: (item.amount / totalExpense) * 100 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
}

function buildBudgetSummary(
  rows: BudgetRow[],
  spentByCategoryId: Map<string, number>,
): DailyDigestBudgetSummary {
  const categories: DailyDigestBudgetCategory[] = [];

  for (const row of rows) {
    const planned = toNumber(row.amount_planned ?? row.planned ?? 0);
    const categoryId = row.category_id ?? row.category?.id ?? null;
    const name = normalizeName(row.name, row.category?.name, row.category_name);
    const actual = categoryId ? spentByCategoryId.get(categoryId) ?? 0 : 0;
    const pct = planned > 0 ? (actual / planned) * 100 : 0;
    categories.push({
      id: categoryId,
      name,
      planned,
      actual,
      pct,
      status: getBudgetStatus(pct),
    });
  }

  categories.sort((a, b) => b.pct - a.pct);

  const plannedTotal = categories.reduce((sum, item) => sum + item.planned, 0);
  const spentTotal = categories.reduce((sum, item) => sum + item.actual, 0);
  const pct = plannedTotal > 0 ? (spentTotal / plannedTotal) * 100 : 0;

  return {
    planned: plannedTotal,
    spent: spentTotal,
    pct,
    status: getBudgetStatus(pct),
    categories,
  };
}

function mergeUpcoming(
  subscriptions: SubscriptionChargeRow[],
  debts: DebtRow[],
): DailyDigestUpcomingItem[] {
  const upcoming: DailyDigestUpcomingItem[] = [];
  for (const row of subscriptions) {
    if (!row) continue;
    const due = row.due_date ? dayjs(row.due_date).tz(TIMEZONE).format(DATE_FORMAT) : null;
    if (!due) continue;
    upcoming.push({
      id: row.id,
      name: normalizeName(row.subscription?.name),
      dueDate: due,
      amount: toNumber(row.amount),
      type: "subscription",
    });
  }
  for (const row of debts) {
    if (!row?.due_date) continue;
    const due = dayjs(row.due_date).tz(TIMEZONE);
    if (!due.isValid()) continue;
    upcoming.push({
      id: row.id,
      name: normalizeName(row.title),
      dueDate: due.format(DATE_FORMAT),
      amount: toNumber(row.amount),
      type: "debt",
    });
  }

  return upcoming
    .filter((item) => item.dueDate)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
    .slice(0, 8);
}

async function fetchDailyDigest(userId: string): Promise<DailyDigestData> {
  const reference = nowInTz();
  const todayKey = reference.format(DATE_FORMAT);
  const { start: monthStart, end: monthEnd } = getMonthRange(reference);
  const { start: upcomingStart, end: upcomingEnd } = getUpcomingRange(reference);

  const [accountsRows, transactionRows] = await Promise.all([
    fetchRows<AccountRow[]>(
      supabase
        .from("accounts")
        .select("id,balance,is_archived")
        .eq("user_id", userId),
      "akun",
    ),
    fetchRows<TransactionRow[]>(
      supabase
        .from("transactions")
        .select("id,type,amount,date,category_id,category:categories(id,name)")
        .eq("user_id", userId)
        .in("type", ["income", "expense"])
        .gte("date", monthStart.format(DATE_FORMAT))
        .lt("date", monthEnd.format(DATE_FORMAT)),
      "transaksi",
    ),
  ]);

  const budgetRows = await fetchRows<BudgetRow[]>(
    supabase
      .from("budgets")
      .select("id,category_id,name,amount_planned,planned,period_month,category:categories(id,name)")
      .eq("user_id", userId)
      .eq("period_month", monthStart.format(DATE_FORMAT)),
    "anggaran",
  );

  const [subscriptionRows, debtRows] = await Promise.all([
    fetchRows<SubscriptionChargeRow[]>(
      supabase
        .from("subscription_charges")
        .select("id,amount,due_date,status,subscription:subscriptions(id,name)")
        .eq("user_id", userId)
        .in("status", ["due", "overdue"])
        .gte("due_date", upcomingStart.format(DATE_FORMAT))
        .lte("due_date", upcomingEnd.format(DATE_FORMAT))
        .order("due_date", { ascending: true })
        .limit(12),
      "jadwal langganan",
    ),
    fetchRows<DebtRow[]>(
      supabase
        .from("debts")
        .select("id,title,due_date,amount,status")
        .eq("user_id", userId)
        .in("status", ["ongoing", "overdue"])
        .gte("due_date", upcomingStart.toISOString())
        .lte("due_date", upcomingEnd.toISOString())
        .order("due_date", { ascending: true })
        .limit(12),
      "hutang",
    ),
  ]);

  const activeAccounts = accountsRows.filter((row) => row && row.is_archived !== true);
  const totalBalance = activeAccounts.reduce((sum, row) => sum + toNumber(row.balance), 0);

  const { monthExpense, todayExpense, todayIncome, categories, spentByCategoryId } =
    computeTransactions(transactionRows, todayKey);

  const topCategories = enrichTopCategories(categories, monthExpense);
  const budgets = buildBudgetSummary(budgetRows, spentByCategoryId);
  const upcoming = mergeUpcoming(subscriptionRows, debtRows);

  const netToday = todayIncome - todayExpense;
  const previousBalance = totalBalance - netToday;
  const diff = totalBalance - previousBalance;
  const direction: TrendDirection = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const changePercent = previousBalance !== 0 ? (diff / Math.abs(previousBalance)) * 100 : null;

  const daysElapsed = Math.max(reference.date(), 1);
  const average = daysElapsed > 0 ? monthExpense / daysElapsed : 0;
  const difference = todayExpense - average;
  const differencePercent = average > 0 ? (difference / average) * 100 : null;
  const expenseDirection: TrendDirection = difference > 0 ? "up" : difference < 0 ? "down" : "flat";

  return {
    generatedAt: new Date().toISOString(),
    todayKey,
    balance: {
      total: totalBalance,
      previous: previousBalance,
      diff,
      changePercent,
      direction,
    },
    today: {
      expense: todayExpense,
      income: todayIncome,
      average,
      difference,
      differencePercent,
      direction: expenseDirection,
    },
    budgets,
    topCategories,
    upcoming,
  };
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getDigestStorageKey(date: string, userId: string): string {
  return `${STORAGE_PREFIX}_${date}_${userId}`;
}

export function hasSeenDailyDigest(date: string, userId: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const key = getDigestStorageKey(date, userId);
  return storage.getItem(key) === "1";
}

export function markDailyDigestSeen(date: string, userId: string): void {
  const storage = getStorage();
  if (!storage) return;
  const key = getDigestStorageKey(date, userId);
  storage.setItem(key, "1");
}

export default function useDailyDigest(): UseDailyDigestResult {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [todayKey, setTodayKey] = useState<string>(() => getDigestTodayKey());

  useEffect(() => {
    let cancelled = false;
    getCurrentUserId()
      .then((id) => {
        if (!cancelled) setUserId(id ?? null);
      })
      .catch(() => {
        if (!cancelled) setUserId(null);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const nextId = session?.user?.id ?? null;
      setUserId(nextId);
      if (!nextId) {
        queryClient.removeQueries({ queryKey: ["daily-digest"] });
      }
    });

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const interval = window.setInterval(() => {
      setTodayKey(getDigestTodayKey());
    }, 60_000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const queryKey = useMemo(() => ["daily-digest", userId, todayKey], [userId, todayKey]);

  const query = useQuery<DailyDigestData, Error>({
    queryKey,
    queryFn: () => fetchDailyDigest(userId as string),
    enabled: Boolean(userId),
    staleTime: 90_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(async () => {
    const result = await query.refetch();
    return result.data;
  }, [query]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch,
    userId,
    todayKey,
  };
}
