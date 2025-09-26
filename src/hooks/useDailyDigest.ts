import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { supabase } from "../lib/supabase.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "Asia/Jakarta";
export type BudgetStatus = "safe" | "warning" | "over";

export interface BalanceSummary {
  total: number;
  previous: number;
  change: number;
  direction: "up" | "down" | "flat";
  accounts: number;
}

export interface TodayExpenseSummary {
  total: number;
  average: number;
  diff: number;
}

export interface BudgetCategoryProgress {
  id: string | null;
  name: string;
  spent: number;
  planned: number;
  percent: number;
  status: BudgetStatus;
}

export interface BudgetProgressSummary {
  spent: number;
  planned: number;
  percent: number;
  status: BudgetStatus;
  categories: BudgetCategoryProgress[];
}

export interface TopCategorySummary {
  id: string | null;
  name: string;
  amount: number;
  percent: number;
}

export interface UpcomingItem {
  id: string;
  type: "subscription" | "debt";
  name: string;
  dueDate: string;
  amount: number;
  currency: string;
}

export interface DailyDigestData {
  balance: BalanceSummary;
  today: TodayExpenseSummary;
  budget: BudgetProgressSummary;
  topCategories: TopCategorySummary[];
  upcoming: UpcomingItem[];
  todayKey: string;
  monthKey: string;
  monthStart: string;
  monthLabel: string;
  todayLabel: string;
}

interface UseDailyDigestOptions {
  userId?: string | null;
  enabled?: boolean;
}

type AccountRow = {
  id: string;
  balance: number | string | null;
  is_archived?: boolean | null;
};

type TransactionRow = {
  id: string;
  type: string | null;
  amount: number | string | null;
  date: string | null;
  category_id: string | null;
  deleted_at: string | null;
  categories?: { id: string; name: string | null } | null;
};

type BudgetRow = {
  id: string;
  planned: number | string | null;
  category_id: string | null;
  name: string | null;
};

type SubscriptionChargeRow = {
  id: string;
  due_date: string | null;
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  subscription?: { id: string; name: string | null } | null;
};

type DebtRow = {
  id: string;
  title: string | null;
  due_date: string | null;
  amount: number | string | null;
  status: string | null;
  type: string | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  return parsed.tz(TIMEZONE).format("YYYY-MM-DD");
}

function getTodayKey(): string {
  return dayjs().tz(TIMEZONE).format("YYYY-MM-DD");
}

function getMonthKey(): string {
  return dayjs().tz(TIMEZONE).format("YYYY-MM");
}

function getMonthStartDate(): string {
  return dayjs().tz(TIMEZONE).startOf("month").format("YYYY-MM-DD");
}

function getMonthEndExclusive(): string {
  return dayjs().tz(TIMEZONE).startOf("month").add(1, "month").format("YYYY-MM-DD");
}

function getTodayLabel(): string {
  return dayjs().tz(TIMEZONE).format("dddd, DD MMMM YYYY");
}

function getMonthLabel(): string {
  return dayjs().tz(TIMEZONE).format("MMMM YYYY");
}

function computeBudgetStatus(percent: number): BudgetStatus {
  if (!Number.isFinite(percent) || percent < 0.9) {
    return "safe";
  }
  if (percent >= 1) return "over";
  return "warning";
}

async function fetchAccounts(userId: string): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from<AccountRow>("accounts")
    .select("id,balance,is_archived")
    .or("is_archived.is.null,is_archived.eq.false")
    .eq("user_id", userId);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function fetchTransactions(
  userId: string,
  monthStart: string,
  monthEndExclusive: string,
): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from<TransactionRow>("transactions")
    .select("id,type,amount,date,category_id,deleted_at,categories(id,name)")
    .is("deleted_at", null)
    .gte("date", monthStart)
    .lt("date", monthEndExclusive)
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function fetchBudgets(userId: string, monthStart: string): Promise<BudgetRow[]> {
  const { data, error } = await supabase
    .from<BudgetRow>("budgets")
    .select("id,planned,category_id,name")
    .eq("period_month", monthStart)
    .eq("user_id", userId);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function fetchUpcoming(userId: string, windowEnd: string): Promise<UpcomingItem[]> {
  const today = getTodayKey();
  const items: UpcomingItem[] = [];

  try {
    const { data: charges, error: chargeError } = await supabase
      .from<SubscriptionChargeRow>("subscription_charges")
      .select("id,due_date,amount,currency,status,subscription(id,name)")
      .gte("due_date", today)
      .lte("due_date", windowEnd)
      .in("status", ["due", "overdue"])
      .eq("user_id", userId)
      .order("due_date", { ascending: true })
      .limit(20);
    if (chargeError) throw chargeError;
    if (Array.isArray(charges)) {
      for (const row of charges) {
        const dateKey = asDateKey(row.due_date);
        if (!dateKey) continue;
        items.push({
          id: row.id,
          type: "subscription",
          name: row.subscription?.name?.trim() || "Langganan",
          dueDate: dateKey,
          amount: toNumber(row.amount),
          currency: row.currency?.trim() || "IDR",
        });
      }
    }
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn("[DailyDigest] Failed to fetch subscription charges", error);
    }
  }

  try {
    const { data: debts, error: debtError } = await supabase
      .from<DebtRow>("debts")
      .select("id,title,due_date,amount,status,type")
      .not("due_date", "is", null)
      .gte("due_date", `${today}T00:00:00Z`)
      .lte("due_date", `${windowEnd}T23:59:59Z`)
      .in("status", ["ongoing", "overdue"])
      .eq("user_id", userId)
      .limit(20);
    if (debtError) throw debtError;
    if (Array.isArray(debts)) {
      for (const row of debts) {
        const dateKey = asDateKey(row.due_date);
        if (!dateKey) continue;
        items.push({
          id: row.id,
          type: "debt",
          name: row.title?.trim() || "Hutang",
          dueDate: dateKey,
          amount: toNumber(row.amount),
          currency: "IDR",
        });
      }
    }
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn("[DailyDigest] Failed to fetch debts", error);
    }
  }

  return items
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);
}

async function buildDailyDigest(userId: string): Promise<DailyDigestData> {
  const todayKey = getTodayKey();
  const monthKey = getMonthKey();
  const monthStart = getMonthStartDate();
  const monthEndExclusive = getMonthEndExclusive();
  const monthLabel = getMonthLabel();
  const todayLabel = getTodayLabel();
  const upcomingWindowEnd = dayjs(todayKey).add(7, "day").format("YYYY-MM-DD");

  const [accounts, transactions, budgets, upcoming] = await Promise.all([
    fetchAccounts(userId),
    fetchTransactions(userId, monthStart, monthEndExclusive),
    fetchBudgets(userId, monthStart),
    fetchUpcoming(userId, upcomingWindowEnd),
  ]);

  const totalBalance = accounts
    .filter((row) => !row.is_archived)
    .reduce((sum, row) => sum + toNumber(row.balance), 0);
  const todayStart = dayjs.tz(todayKey, "YYYY-MM-DD", TIMEZONE);
  const yesterdayBalanceEstimate = transactions
    .filter((row) => asDateKey(row.date) === todayKey)
    .reduce((acc, row) => {
      const amount = toNumber(row.amount);
      if (!amount) return acc;
      if (row.type === "income") return acc - amount;
      if (row.type === "expense") return acc + amount;
      return acc;
    }, totalBalance);

  const netChange = totalBalance - yesterdayBalanceEstimate;
  const direction: "up" | "down" | "flat" = Math.abs(netChange) < 1
    ? "flat"
    : netChange > 0
      ? "up"
      : "down";

  const daysElapsed = Math.max(1, todayStart.diff(dayjs.tz(monthStart, "YYYY-MM-DD", TIMEZONE), "day") + 1);

  const todayExpenseTotal = transactions
    .filter((row) => row.type === "expense" && asDateKey(row.date) === todayKey)
    .reduce((sum, row) => sum + toNumber(row.amount), 0);

  const monthExpenseTotal = transactions
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + toNumber(row.amount), 0);

  const averageDailyExpense = monthExpenseTotal / daysElapsed;

  const budgetSpentByCategory = new Map<string, number>();
  for (const row of transactions) {
    if (row.type !== "expense") continue;
    const key = row.category_id ?? row.categories?.id ?? "__uncategorized";
    budgetSpentByCategory.set(key, (budgetSpentByCategory.get(key) || 0) + toNumber(row.amount));
  }

  const budgetCategories: BudgetCategoryProgress[] = budgets.map((row) => {
    const spent = budgetSpentByCategory.get(row.category_id ?? "__uncategorized") ?? 0;
    const planned = toNumber(row.planned);
    const percent = planned > 0 ? spent / planned : 0;
    return {
      id: row.category_id,
      name: row.name?.trim() || "Tanpa kategori",
      spent,
      planned,
      percent,
      status: computeBudgetStatus(percent),
    };
  });

  const plannedTotal = budgetCategories.reduce((sum, row) => sum + row.planned, 0);
  const budgetPercent = plannedTotal > 0 ? monthExpenseTotal / plannedTotal : 0;
  const budgetStatus = computeBudgetStatus(budgetPercent);

  const topCategoryTotals = new Map<string, { id: string | null; name: string; total: number }>();
  for (const row of transactions) {
    if (row.type !== "expense") continue;
    const key = row.category_id ?? row.categories?.id ?? row.categories?.name ?? "__uncategorized";
    const name = row.categories?.name?.trim() || "Tanpa kategori";
    const entry = topCategoryTotals.get(key) ?? { id: row.category_id, name, total: 0 };
    entry.total += toNumber(row.amount);
    topCategoryTotals.set(key, entry);
  }

  const topCategories: TopCategorySummary[] = Array.from(topCategoryTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      name: item.name,
      amount: item.total,
      percent: monthExpenseTotal > 0 ? item.total / monthExpenseTotal : 0,
    }));

  return {
    balance: {
      total: totalBalance,
      previous: yesterdayBalanceEstimate,
      change: netChange,
      direction,
      accounts: accounts.filter((row) => !row.is_archived).length,
    },
    today: {
      total: todayExpenseTotal,
      average: averageDailyExpense,
      diff: todayExpenseTotal - averageDailyExpense,
    },
    budget: {
      spent: monthExpenseTotal,
      planned: plannedTotal,
      percent: budgetPercent,
      status: budgetStatus,
      categories: budgetCategories
        .slice()
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 3),
    },
    topCategories,
    upcoming,
    todayKey,
    monthKey,
    monthStart,
    monthLabel,
    todayLabel,
  };
}

export default function useDailyDigest(options: UseDailyDigestOptions = {}) {
  const { userId, enabled = true } = options;

  const query = useQuery<DailyDigestData, Error>({
    queryKey: ["daily-digest", userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User ID is required to load daily digest");
      }
      return buildDailyDigest(userId);
    },
    enabled: Boolean(userId) && enabled,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  return useMemo(() => ({ ...query }), [query]);
}

export { getTodayKey as getDigestTodayKey };
