import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../lib/format";
import { useToast } from "../context/ToastContext";

const TIMEZONE = "Asia/Jakarta";
const CACHE_KEY = "hw:daily-digest:v2";
const CACHE_TTL_MS = 90_000;

const ACCENT_ACCOUNT_TYPES = new Set(["cash", "bank", "ewallet"]);

export interface DailyDigestCategoryItem {
  id: string | null;
  name: string;
  total: number;
  pctOfMTD: number;
}

export interface DailyDigestUpcomingItem {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
}

export interface DailyDigestBudgetWarning {
  id: string;
  name: string;
  planned: number;
  actual: number;
  progressPct: number;
  categoryId: string | null;
}

export interface DailyDigestData {
  balance: number;
  balanceChange: number;
  balanceDirection: "up" | "down" | "flat";
  todayExpense: { total: number; vsAvgDailyMonthPct: number; averageDaily: number };
  wtd: { total: number; vsAvgWeekly3mPct: number; averageWeekly: number };
  mtd: { total: number; vsBudgetPct?: number; budgetAmount?: number };
  topCategories: DailyDigestCategoryItem[];
  budgetWarnings: DailyDigestBudgetWarning[];
  upcoming: {
    subscriptions: DailyDigestUpcomingItem[];
    debts: DailyDigestUpcomingItem[];
  };
  insight: string;
  generatedAt: string;
}

export interface UseDailyDigestResult {
  data: DailyDigestData | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

type MemoryCacheEntry = { data: DailyDigestData; expiresAt: number };

const memoryCache = new Map<string, MemoryCacheEntry>();

const DEFAULT_DATA: DailyDigestData = {
  balance: 0,
  balanceChange: 0,
  balanceDirection: "flat",
  todayExpense: { total: 0, vsAvgDailyMonthPct: 0, averageDaily: 0 },
  wtd: { total: 0, vsAvgWeekly3mPct: 0, averageWeekly: 0 },
  mtd: { total: 0 },
  topCategories: [],
  budgetWarnings: [],
  upcoming: { subscriptions: [], debts: [] },
  insight: "Belum ada data transaksi untuk ditampilkan.",
  generatedAt: new Date().toISOString(),
};

interface RawTransactionRow {
  id?: string;
  type?: string;
  amount?: number | string | null;
  date?: string | null;
  category_id?: string | null;
  categories?: { name?: string | null } | null;
  category?: { name?: string | null } | null;
}

interface RawBudgetRow {
  id?: string;
  category_id?: string | null;
  name?: string | null;
  planned?: number | string | null;
  period_month?: string | null;
}

interface RawAccountRow {
  id?: string;
  type?: string | null;
  balance?: number | string | null;
  current_balance?: number | string | null;
  initial_balance?: number | string | null;
  latest_balance?: number | string | null;
  is_archived?: boolean | null;
  archived?: boolean | null;
  active?: boolean | null;
}

interface RawUpcomingRow {
  id?: string;
  name?: string | null;
  title?: string | null;
  due_date?: string | null;
  dueDate?: string | null;
  amount?: number | string | null;
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getLocalDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [yearStr, monthStr, dayStr] = formatter.format(date).split("-");
  return {
    year: Number.parseInt(yearStr, 10),
    month: Number.parseInt(monthStr, 10),
    day: Number.parseInt(dayStr, 10),
  };
}

function toDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function fromLocalParts(parts: { year: number; month: number; day: number }): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function addDays(date: Date, offset: number): Date {
  const cloned = new Date(date.getTime());
  cloned.setUTCDate(cloned.getUTCDate() + offset);
  return cloned;
}

function addMonths(date: Date, offset: number): Date {
  const cloned = new Date(date.getTime());
  cloned.setUTCMonth(cloned.getUTCMonth() + offset, 1);
  return cloned;
}

function startOfWeek(date: Date): Date {
  const parts = getLocalDateParts(date);
  const localMidnight = fromLocalParts(parts);
  const weekday = localMidnight.getUTCDay();
  const isoWeekday = weekday === 0 ? 7 : weekday;
  const start = new Date(localMidnight.getTime());
  start.setUTCDate(localMidnight.getUTCDate() - (isoWeekday - 1));
  return start;
}

function startOfMonth(date: Date): Date {
  const parts = getLocalDateParts(date);
  return fromLocalParts({ year: parts.year, month: parts.month, day: 1 });
}

function clampDateString(value: string | null | undefined): string | null {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function extractCategoryName(row: RawTransactionRow): string {
  const candidates = [
    row.categories?.name,
    row.category?.name,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "Tanpa kategori";
}

function computeBalance(accounts: RawAccountRow[]): { total: number; change: number; direction: "up" | "down" | "flat" } {
  let total = 0;
  for (const account of accounts) {
    const type = typeof account.type === "string" ? account.type.toLowerCase() : "";
    if (type && !ACCENT_ACCOUNT_TYPES.has(type)) continue;
    const archived = account.is_archived ?? account.archived ?? false;
    if (archived) continue;
    const active = account.active ?? true;
    if (active === false) continue;
    const balanceCandidates = [
      account.balance,
      account.current_balance,
      account.latest_balance,
      account.initial_balance,
    ];
    for (const candidate of balanceCandidates) {
      const numeric = toNumber(candidate);
      if (numeric) {
        total += numeric;
        break;
      }
    }
  }
  return { total, change: 0, direction: "flat" };
}

function groupBy<T>(items: T[], keyGetter: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyGetter(item);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

function sumAmounts(rows: RawTransactionRow[]): number {
  let total = 0;
  for (const row of rows) {
    total += toNumber(row.amount);
  }
  return total;
}

function buildInsight(
  weekTransactions: RawTransactionRow[],
  weeklyCategoryTotals: Map<string, number>,
  weeklyCategoryCounts: Map<string, number>,
  historicalWeeklyTotals: Map<string, number[]>,
  nameLookup: Map<string, string>,
): string {
  if (!weekTransactions.length) {
    return "Minggu ini belum ada transaksi tercatat.";
  }

  let focusCategory: string | null = null;
  let focusTotal = 0;
  for (const [categoryId, total] of weeklyCategoryTotals.entries()) {
    if (!focusCategory || total > focusTotal) {
      focusCategory = categoryId;
      focusTotal = total;
    }
  }
  if (!focusCategory) {
    return "Minggu ini belum ada transaksi pengeluaran.";
  }
  const displayName = nameLookup.get(focusCategory) ?? "Tanpa kategori";
  const occurrences = weeklyCategoryCounts.get(focusCategory) ?? weekTransactions.length;
  const totalsHistory = historicalWeeklyTotals.get(focusCategory) ?? [];
  const historyAverage = totalsHistory.length
    ? totalsHistory.reduce((sum, value) => sum + value, 0) / totalsHistory.length
    : 0;
  if (!historyAverage) {
    return `Minggu ini ${displayName} ${occurrences}x, total ${formatCurrency(focusTotal)}.`;
  }
  const comparison = focusTotal >= historyAverage ? "di atas" : "di bawah";
  return `Minggu ini ${displayName} ${occurrences}x, total ${formatCurrency(
    focusTotal,
  )}; ${comparison} rata-rata mingguan kategori '${displayName}'.`;
}

async function fetchDailyDigest(userId: string, signal?: AbortSignal): Promise<DailyDigestData> {
  const now = new Date();
  const todayParts = getLocalDateParts(now);
  const todayLocal = fromLocalParts(todayParts);
  const todayStr = toDateString(todayLocal);
  const weekStartDate = startOfWeek(todayLocal);
  const weekStartStr = toDateString(weekStartDate);
  const monthStartDate = startOfMonth(todayLocal);
  const monthStartStr = toDateString(monthStartDate);
  const threeMonthsAgoStart = startOfMonth(addMonths(monthStartDate, -2));
  const historicalStart = toDateString(addMonths(threeMonthsAgoStart, -1));
  const endOfRange = todayStr;
  const nextSeven = toDateString(addDays(todayLocal, 7));

  const accountsPromise = supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .abortSignal(signal ?? undefined);

  const transactionsPromise = supabase
    .from("transactions")
    .select("id,type,amount,date,category_id,categories(name)")
    .eq("user_id", userId)
    .in("type", ["expense", "income"])
    .gte("date", historicalStart)
    .lte("date", endOfRange)
    .abortSignal(signal ?? undefined);

  const budgetsPromise = supabase
    .from("budgets")
    .select("id,category_id,name,planned,period_month")
    .eq("user_id", userId)
    .eq("period_month", monthStartStr)
    .abortSignal(signal ?? undefined);

  async function fetchUpcoming() {
    const subscriptionsResponse = await supabase
      .from("subscription_charges")
      .select("id,subscription_id,subscriptions(name),due_date,amount,currency,status")
      .eq("user_id", userId)
      .in("status", ["due", "overdue"])
      .gte("due_date", todayStr)
      .lte("due_date", nextSeven)
      .order("due_date", { ascending: true })
      .abortSignal(signal ?? undefined);

    if (subscriptionsResponse.error) throw subscriptionsResponse.error;

    const debtsResponse = await supabase
      .from("debts")
      .select("id,title,party_name,due_date,amount,status")
      .eq("user_id", userId)
      .not("status", "eq", "paid")
      .gte("due_date", todayStr)
      .lte("due_date", nextSeven)
      .order("due_date", { ascending: true })
      .abortSignal(signal ?? undefined);

    if (debtsResponse.error) throw debtsResponse.error;

    return {
      subscriptions: subscriptionsResponse.data ?? [],
      debts: debtsResponse.data ?? [],
    };
  }

  const [accountsRes, transactionsRes, budgetsRes, upcomingData] = await Promise.all([
    accountsPromise,
    transactionsPromise,
    budgetsPromise,
    fetchUpcoming(),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (transactionsRes.error) throw transactionsRes.error;
  if (budgetsRes.error) throw budgetsRes.error;

  const accountsData = accountsRes.data;
  const transactionsData = transactionsRes.data;
  const budgetsData = budgetsRes.data;

  const accounts = Array.isArray(accountsData) ? (accountsData as RawAccountRow[]) : [];
  const transactions = Array.isArray(transactionsData)
    ? (transactionsData as RawTransactionRow[])
    : [];
  const budgets = Array.isArray(budgetsData) ? (budgetsData as RawBudgetRow[]) : [];

  const balanceInfo = computeBalance(accounts);

  const transactionsByDate = groupBy(transactions, (row) => clampDateString(row.date) ?? "");

  const todayTransactions = transactionsByDate.get(todayStr) ?? [];
  const todayExpenseTotal = sumAmounts(todayTransactions.filter((row) => row.type === "expense"));
  const todayIncomeTotal = sumAmounts(todayTransactions.filter((row) => row.type === "income"));
  balanceInfo.change = todayIncomeTotal - todayExpenseTotal;
  if (balanceInfo.change > 0) balanceInfo.direction = "up";
  else if (balanceInfo.change < 0) balanceInfo.direction = "down";

  const monthTransactions = transactions.filter((row) => {
    const dateStr = clampDateString(row.date);
    return dateStr !== null && dateStr >= monthStartStr && dateStr <= todayStr;
  });
  const monthExpenses = monthTransactions.filter((row) => row.type === "expense");
  const monthExpenseTotal = sumAmounts(monthExpenses);

  const daysElapsed = Math.max(1, Math.min(todayParts.day, 31));
  const averageDaily = monthExpenseTotal / daysElapsed;
  const vsAvgDailyPct = averageDaily ? (todayExpenseTotal / averageDaily) * 100 : 0;

  const weekTransactions = transactions.filter((row) => {
    const dateStr = clampDateString(row.date);
    return dateStr !== null && dateStr >= weekStartStr && dateStr <= todayStr;
  });
  const weekExpenses = weekTransactions.filter((row) => row.type === "expense");
  const weekExpenseTotal = sumAmounts(weekExpenses);

  const weeklyBuckets = new Map<string, RawTransactionRow[]>();
  for (const row of transactions) {
    const dateStr = clampDateString(row.date);
    if (!dateStr) continue;
    if (row.type !== "expense") continue;
    const parts = dateStr.split("-").map((value) => Number.parseInt(value, 10));
    if (parts.length !== 3) continue;
    const dateObj = fromLocalParts({ year: parts[0], month: parts[1], day: parts[2] });
    const bucketStart = toDateString(startOfWeek(dateObj));
    const existing = weeklyBuckets.get(bucketStart);
    if (existing) existing.push(row);
    else weeklyBuckets.set(bucketStart, [row]);
  }

  const currentWeekKey = toDateString(weekStartDate);
  const historicalWeeks: number[] = [];
  const categoryHistoryTotals = new Map<string, number[]>();
  weeklyBuckets.forEach((rows, key) => {
    if (key === currentWeekKey) return;
    const total = sumAmounts(rows);
    historicalWeeks.push(total);
    const grouped = groupBy(rows, (row) => row.category_id ?? "__null__");
    grouped.forEach((items, categoryId) => {
      if (!categoryHistoryTotals.has(categoryId)) {
        categoryHistoryTotals.set(categoryId, []);
      }
      categoryHistoryTotals.get(categoryId)!.push(sumAmounts(items));
    });
  });

  const averageWeekly = historicalWeeks.length
    ? historicalWeeks.reduce((sum, value) => sum + value, 0) / historicalWeeks.length
    : 0;
  const vsAvgWeeklyPct = averageWeekly ? (weekExpenseTotal / averageWeekly) * 100 : 0;

  const monthByCategory = groupBy(monthExpenses, (row) => row.category_id ?? "__null__");
  const monthTotal = monthExpenseTotal || 1;
  const categoryNameMap = new Map<string, string>();
  const topCategories: DailyDigestCategoryItem[] = [];
  monthByCategory.forEach((rows, categoryId) => {
    const total = sumAmounts(rows);
    const name = extractCategoryName(rows[0]);
    categoryNameMap.set(categoryId, name);
    topCategories.push({
      id: categoryId === "__null__" ? null : categoryId,
      name,
      total,
      pctOfMTD: total / monthTotal,
    });
  });
  topCategories.sort((a, b) => b.total - a.total);
  const topThree = topCategories.slice(0, 3);

  const budgetWarnings: DailyDigestBudgetWarning[] = [];
  const totalBudgetPlanned = budgets.reduce((sum, budget) => sum + toNumber(budget.planned), 0);
  let totalBudgetActual = 0;
  for (const budget of budgets) {
    const planned = toNumber(budget.planned);
    if (!planned) continue;
    const key = budget.category_id ?? "__null__";
    const actual = monthByCategory.get(key)?.reduce((sum, row) => sum + toNumber(row.amount), 0) ?? 0;
    totalBudgetActual += actual;
    const progress = planned ? (actual / planned) * 100 : 0;
    if (progress >= 90) {
      const name = budget.name?.trim()
        ? budget.name.trim()
        : categoryNameMap.get(key) ?? "Tanpa kategori";
      budgetWarnings.push({
        id: String(budget.id ?? key ?? Math.random()),
        name,
        planned,
        actual,
        progressPct: progress,
        categoryId: budget.category_id ?? null,
      });
    }
  }
  budgetWarnings.sort((a, b) => b.progressPct - a.progressPct);

  const weeklyCategoryTotals = new Map<string, number>();
  const weeklyCategoryCounts = new Map<string, number>();
  for (const row of weekExpenses) {
    const categoryId = row.category_id ?? "__null__";
    weeklyCategoryTotals.set(
      categoryId,
      (weeklyCategoryTotals.get(categoryId) ?? 0) + toNumber(row.amount),
    );
    weeklyCategoryCounts.set(categoryId, (weeklyCategoryCounts.get(categoryId) ?? 0) + 1);
    if (!categoryNameMap.has(categoryId)) {
      categoryNameMap.set(categoryId, extractCategoryName(row));
    }
  }

  const insight = buildInsight(
    weekExpenses,
    weeklyCategoryTotals,
    weeklyCategoryCounts,
    categoryHistoryTotals,
    categoryNameMap,
  );

  const subscriptions = Array.isArray(upcomingData.subscriptions)
    ? (upcomingData.subscriptions as RawUpcomingRow[])
    : [];
  const debts = Array.isArray(upcomingData.debts)
    ? (upcomingData.debts as RawUpcomingRow[])
    : [];

  const normalizeUpcoming = (rows: RawUpcomingRow[], fallbackName: string) =>
    rows.map((row) => ({
      id: String(row.id ?? fallbackName),
      name: row.name?.trim() || row.title?.trim() || fallbackName,
      dueDate: clampDateString(row.due_date ?? row.dueDate) ?? todayStr,
      amount: toNumber(row.amount),
    }));

  const digest: DailyDigestData = {
    balance: balanceInfo.total,
    balanceChange: balanceInfo.change,
    balanceDirection: balanceInfo.direction,
    todayExpense: {
      total: todayExpenseTotal,
      vsAvgDailyMonthPct: vsAvgDailyPct,
      averageDaily,
    },
    wtd: {
      total: weekExpenseTotal,
      vsAvgWeekly3mPct: vsAvgWeeklyPct,
      averageWeekly,
    },
    mtd: {
      total: monthExpenseTotal,
      vsBudgetPct: totalBudgetPlanned ? (totalBudgetActual / totalBudgetPlanned) * 100 : undefined,
      budgetAmount: totalBudgetPlanned || undefined,
    },
    topCategories: topThree,
    budgetWarnings,
    upcoming: {
      subscriptions: normalizeUpcoming(subscriptions, "Langganan"),
      debts: normalizeUpcoming(debts, "Hutang"),
    },
    insight,
    generatedAt: new Date().toISOString(),
  };

  return digest;
}

function buildCacheKey(userId: string | null): string {
  return `${CACHE_KEY}:${userId ?? "guest"}`;
}

function loadFromStorage(userId: string | null): DailyDigestData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(buildCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt?: number; data?: DailyDigestData };
    if (!parsed?.data || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt < Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function saveToStorage(userId: string | null, data: DailyDigestData) {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ data, expiresAt: Date.now() + CACHE_TTL_MS });
    window.localStorage.setItem(buildCacheKey(userId), payload);
  } catch {
    // ignore storage failures
  }
}

export default function useDailyDigest(): UseDailyDigestResult {
  const { addToast } = useToast();
  const [data, setData] = useState<DailyDigestData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    supabase.auth
      .getUser()
      .then(async ({ data: authData, error: authError }) => {
        if (requestId !== requestIdRef.current) return;
        if (authError) throw authError;
        const userId = authData.user?.id ?? null;

        const memory = memoryCache.get(buildCacheKey(userId));
        if (memory && memory.expiresAt > Date.now()) {
          setData(memory.data);
        } else {
          const stored = loadFromStorage(userId);
          if (stored) {
            setData(stored);
          }
        }

        if (!userId) {
          setData(DEFAULT_DATA);
          setLoading(false);
          return;
        }

        const controller = new AbortController();
        const signal = controller.signal;
        try {
          const digest = await fetchDailyDigest(userId, signal);
          if (requestId !== requestIdRef.current) return;
          setData(digest);
          setLoading(false);
          memoryCache.set(buildCacheKey(userId), {
            data: digest,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
          saveToStorage(userId, digest);
        } catch (err) {
          if (requestId !== requestIdRef.current) return;
          const fallback = memoryCache.get(buildCacheKey(userId))?.data ?? loadFromStorage(userId);
          if (fallback) {
            setData(fallback);
          } else {
            setData(DEFAULT_DATA);
          }
          const normalized = err instanceof Error ? err : new Error("Gagal memuat Daily Digest");
          setError(normalized);
          setLoading(false);
          addToast?.("Gagal memuat ringkasan harian. Silakan coba lagi.", "error");
        }
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        const normalized = err instanceof Error ? err : new Error("Gagal memuat Daily Digest");
        setError(normalized);
        setData(DEFAULT_DATA);
        setLoading(false);
        addToast?.("Gagal memuat ringkasan harian. Silakan coba lagi.", "error");
      });
  }, [addToast]);

  useEffect(() => {
    refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}
