import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { buildSupabaseHeaders, createRestUrl, fetchJson } from "../lib/supabaseRest";
import { useToast } from "../context/ToastContext";

const TIMEZONE = "Asia/Jakarta";
const CACHE_PREFIX = "hw:daily-digest:v2:";
const CACHE_TTL_MS = 90_000;
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const memoryCache = new Map<string, CachedDigest>();

type UUID = string;

type DailyRow = {
  date: string;
  type: string;
  total: number;
};

type CategoryRow = {
  category_id: string | null;
  category?: { name?: string | null } | null;
  total: number;
};

type TotalsByTypeRow = {
  type: string;
  total: number;
};

interface CachedDigest {
  data: DailyDigestData;
  expiresAt: number;
}

interface BudgetRow {
  id: string;
  name: string | null;
  planned: number;
  category_id: string | null;
}

interface SubscriptionRow {
  id: string;
  name: string;
  next_due_date: string | null;
  amount: number | null;
}

interface DebtRow {
  id: string;
  title: string;
  party_name: string | null;
  due_date: string | null;
  amount: number | null;
  status: string | null;
}

export interface BalanceSummary {
  total: number;
  diff: number;
  direction: "up" | "down" | "flat";
}

export interface TodayExpenseSummary {
  total: number;
  avgDaily: number;
  ratio: number;
}

export interface PeriodSummary {
  total: number;
  average: number;
  ratio: number;
}

export interface MonthSummary {
  total: number;
  budgetTotal: number | null;
  ratioToBudget: number | null;
}

export interface TopCategoryItem {
  id: string | null;
  name: string;
  total: number;
  pctOfMonth: number;
}

export interface BudgetWarningItem {
  id: string;
  name: string;
  planned: number;
  actual: number;
  progressPct: number;
}

export interface UpcomingItems {
  budgets: BudgetWarningItem[];
  subscriptions: Array<{ id: string; name: string; dueDate: string; amount: number }>;
  debts: Array<{ id: string; name: string; dueDate: string; amount: number }>;
}

export interface DailyDigestData {
  balance: BalanceSummary;
  todayExpense: TodayExpenseSummary;
  wtd: PeriodSummary;
  mtd: MonthSummary;
  topCategories: TopCategoryItem[];
  upcoming: UpcomingItems;
  insight: string;
  hasTodayTransactions: boolean;
}

export interface UseDailyDigestResult {
  data: DailyDigestData | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

function formatDateLocal(date: Date): string {
  return DATE_FORMATTER.format(date);
}

function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00+07:00`);
}

function getTodayLocal(): string {
  return formatDateLocal(new Date());
}

function shiftDateString(base: string, offsetDays: number): string {
  const ref = parseLocalDate(base);
  ref.setUTCDate(ref.getUTCDate() + offsetDays);
  return formatDateLocal(ref);
}

function getWeekday(date: Date): number {
  const label = WEEKDAY_FORMATTER.format(date).toLowerCase().slice(0, 3);
  return WEEKDAY_INDEX[label] ?? 0;
}

function getStartOfWeek(base: string): string {
  const ref = parseLocalDate(base);
  const weekday = getWeekday(ref);
  const diff = (weekday - 1 + 7) % 7;
  return shiftDateString(base, -diff);
}

function getStartOfMonth(base: string): string {
  const [year, month] = base.split("-");
  return `${year}-${month}-01`;
}

function shiftMonthString(base: string, offset: number): string {
  const [yearStr, monthStr, dayStr] = base.split("-");
  let year = Number.parseInt(yearStr, 10);
  let month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return base;
  }
  month += offset;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const resolvedDay = Math.min(day, daysInMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(resolvedDay).padStart(2, "0")}`;
}

function daysBetween(start: string, end: string): number {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  const diff = endDate.getTime() - startDate.getTime();
  return Math.max(Math.floor(diff / (1000 * 60 * 60 * 24)) + 1, 1);
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatInList(values: string[]): string {
  return `(${values.map((value) => `"${value}"`).join(",")})`;
}

async function fetchDailySums(
  userId: string,
  accountIds: string[],
  start: string,
  end: string,
): Promise<DailyRow[]> {
  const params = new URLSearchParams();
  params.set("select", "date,type,amount.sum().as(total)");
  params.append("user_id", `eq.${userId}`);
  params.append("deleted_at", "is.null");
  params.append("type", "in.(\"income\",\"expense\")");
  params.append("date", `gte.${start}`);
  params.append("date", `lte.${end}`);
  if (accountIds.length) {
    params.append("account_id", `in.${formatInList(accountIds)}`);
  }
  params.append("group", "date,type");
  params.append("order", "date.asc");

  const url = createRestUrl("/rest/v1/transactions", params);
  const rows = await fetchJson<Array<{ date: string; type: string; total: number }>>(url, {
    headers: buildSupabaseHeaders(),
  });
  return Array.isArray(rows)
    ? rows.map((row) => ({
        date: String(row.date ?? "").slice(0, 10),
        type: String(row.type ?? ""),
        total: parseNumber(row.total),
      }))
    : [];
}

async function fetchTotalsByType(
  userId: string,
  accountIds: string[],
): Promise<Record<"income" | "expense", number>> {
  const params = new URLSearchParams();
  params.set("select", "type,amount.sum().as(total)");
  params.append("user_id", `eq.${userId}`);
  params.append("deleted_at", "is.null");
  params.append("type", "in.(\"income\",\"expense\")");
  if (accountIds.length) {
    params.append("account_id", `in.${formatInList(accountIds)}`);
  }
  params.append("group", "type");

  const url = createRestUrl("/rest/v1/transactions", params);
  const rows = await fetchJson<TotalsByTypeRow[]>(url, {
    headers: buildSupabaseHeaders(),
  });
  const result: Record<"income" | "expense", number> = { income: 0, expense: 0 };
  for (const row of rows ?? []) {
    const key = row?.type === "income" ? "income" : row?.type === "expense" ? "expense" : null;
    if (!key) continue;
    result[key] = parseNumber(row?.total);
  }
  return result;
}

async function fetchCategoryTotals(
  userId: string,
  accountIds: string[],
  start: string,
  end: string,
): Promise<CategoryRow[]> {
  const params = new URLSearchParams();
  params.set("select", "category_id,category:categories(name),amount.sum().as(total)");
  params.append("user_id", `eq.${userId}`);
  params.append("deleted_at", "is.null");
  params.append("type", "eq.expense");
  params.append("date", `gte.${start}`);
  params.append("date", `lte.${end}`);
  if (accountIds.length) {
    params.append("account_id", `in.${formatInList(accountIds)}`);
  }
  params.append("group", "category_id,category");
  params.append("order", "total.desc.nullslast");

  const url = createRestUrl("/rest/v1/transactions", params);
  const rows = await fetchJson<CategoryRow[]>(url, {
    headers: buildSupabaseHeaders(),
  });
  return Array.isArray(rows)
    ? rows.map((row) => ({
        category_id: row.category_id ?? null,
        category: row.category ?? null,
        total: parseNumber((row as { total?: number }).total),
      }))
    : [];
}

async function fetchBudgets(
  userId: string,
  periodMonth: string,
): Promise<BudgetRow[]> {
  const { data, error } = await supabase
    .from("budgets")
    .select("id,name,planned,category_id")
    .eq("user_id", userId)
    .eq("period_month", periodMonth);
  if (error) throw error;
  return Array.isArray(data)
    ? data.map((row) => ({
        id: String(row.id),
        name: row.name ?? null,
        planned: parseNumber((row as { planned?: number }).planned),
        category_id: (row as { category_id?: string | null }).category_id ?? null,
      }))
    : [];
}

async function fetchUpcomingSubscriptions(
  userId: string,
  start: string,
  end: string,
): Promise<SubscriptionRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id,name,next_due_date,amount,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .gte("next_due_date", start)
    .lte("next_due_date", end)
    .order("next_due_date", { ascending: true });
  if (error) throw error;
  return Array.isArray(data)
    ? data.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? "Langganan"),
        next_due_date: row.next_due_date ?? null,
        amount: parseNumber((row as { amount?: number }).amount),
      }))
    : [];
}

async function fetchUpcomingDebts(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<DebtRow[]> {
  const { data, error } = await supabase
    .from("debts")
    .select("id,title,party_name,due_date,amount,status")
    .eq("user_id", userId)
    .neq("status", "paid")
    .not("due_date", "is", null)
    .gte("due_date", startIso)
    .lte("due_date", endIso)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return Array.isArray(data)
    ? data.map((row) => ({
        id: String(row.id),
        title: String(row.title ?? "Hutang"),
        party_name: row.party_name ?? null,
        due_date: row.due_date ?? null,
        amount: parseNumber((row as { amount?: number }).amount),
        status: row.status ?? null,
      }))
    : [];
}

function computeBalanceSummary(
  totalsByType: Record<"income" | "expense", number>,
  dailySums: Map<string, { income: number; expense: number }>,
  today: string,
): BalanceSummary {
  const incomeTotal = totalsByType.income ?? 0;
  const expenseTotal = totalsByType.expense ?? 0;
  const total = incomeTotal - expenseTotal;
  const todayData = dailySums.get(today);
  const todayIncome = todayData?.income ?? 0;
  const todayExpense = todayData?.expense ?? 0;
  const delta = todayIncome - todayExpense;
  const diff = delta;
  let direction: "up" | "down" | "flat" = "flat";
  if (Math.abs(diff) <= 0.01) direction = "flat";
  else if (diff > 0) direction = "up";
  else direction = "down";
  return { total, diff, direction };
}

function computePeriodTotal(
  dailySums: Map<string, { income: number; expense: number }>,
  start: string,
  end: string,
): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  let cursor = start;
  while (cursor <= end) {
    const entry = dailySums.get(cursor);
    if (entry) {
      income += entry.income;
      expense += entry.expense;
    }
    cursor = shiftDateString(cursor, 1);
  }
  return { income, expense };
}

function buildInsight(
  todayExpense: TodayExpenseSummary,
  week: PeriodSummary,
  month: MonthSummary,
  topCategories: TopCategoryItem[],
): string {
  const top = topCategories[0];
  if (todayExpense.total > 0) {
    const direction = todayExpense.ratio > 1 ? "di atas" : "di bawah";
    return `Hari ini pengeluaranmu ${direction} rata-rata: Rp${Math.round(todayExpense.total).toLocaleString("id-ID")}.`;
  }
  if (top && month.total > 0) {
    return `${top.name} menyumbang ${Math.round(top.pctOfMonth)}% dari pengeluaran bulan ini.`;
  }
  if (week.total > 0 && week.ratio > 1) {
    return `Pengeluaran minggu ini ${Math.round(week.ratio * 100)}% dari rata-rata 3 bulan terakhir.`;
  }
  return "Pengeluaranmu stabil. Tetap pertahankan ritme hematnya!";
}

function mapBudgets(
  budgets: BudgetRow[],
  categoryTotals: Map<string | null, number>,
): BudgetWarningItem[] {
  const warnings: BudgetWarningItem[] = [];
  for (const budget of budgets) {
    if (!budget) continue;
    const planned = budget.planned ?? 0;
    if (planned <= 0) continue;
    const actual = categoryTotals.get(budget.category_id ?? null) ?? 0;
    if (actual <= 0) continue;
    const progress = planned > 0 ? actual / planned : 0;
    if (progress < 0.9) continue;
    warnings.push({
      id: budget.id,
      name: budget.name || "Tanpa kategori",
      planned,
      actual,
      progressPct: progress * 100,
    });
  }
  warnings.sort((a, b) => b.progressPct - a.progressPct);
  return warnings.slice(0, 5);
}

async function computeDigest(userId: string): Promise<DailyDigestData> {
  const today = getTodayLocal();
  const monthStart = getStartOfMonth(today);
  const weekStart = getStartOfWeek(today);
  const threeMonthStart = getStartOfMonth(shiftMonthString(today, -2));
  const weekDayCount = daysBetween(threeMonthStart, today);

  const { data: accountData, error: accountError } = await supabase
    .from("accounts")
    .select("id,type")
    .eq("user_id", userId)
    .in("type", ["cash", "bank", "ewallet"]);
  if (accountError) throw accountError;
  const accountIds = Array.isArray(accountData)
    ? accountData.map((row) => String((row as { id: UUID }).id))
    : [];

  const [dailyRows, totalsByType, categoryRows, budgets, subscriptions, debts] = await Promise.all([
    fetchDailySums(userId, accountIds, threeMonthStart, today),
    fetchTotalsByType(userId, accountIds),
    fetchCategoryTotals(userId, accountIds, monthStart, today),
    fetchBudgets(userId, monthStart),
    fetchUpcomingSubscriptions(userId, today, shiftDateString(today, 7)),
    fetchUpcomingDebts(userId, `${today}T00:00:00+07:00`, `${shiftDateString(today, 7)}T23:59:59+07:00`),
  ]);

  const dailyMap = new Map<string, { income: number; expense: number }>();
  for (const row of dailyRows) {
    const existing = dailyMap.get(row.date) ?? { income: 0, expense: 0 };
    if (row.type === "income") {
      existing.income += row.total;
    } else if (row.type === "expense") {
      existing.expense += row.total;
    }
    dailyMap.set(row.date, existing);
  }

  const todayEntry = dailyMap.get(today) ?? { income: 0, expense: 0 };
  const todayTotalExpense = todayEntry.expense;
  const dayOfMonth = Number.parseInt(today.slice(8, 10), 10) || 1;
  const monthTotals = computePeriodTotal(dailyMap, monthStart, today);
  const weekTotals = computePeriodTotal(dailyMap, weekStart, today);
  const quarterTotals = computePeriodTotal(dailyMap, threeMonthStart, today);

  const avgDaily = monthTotals.expense / dayOfMonth || 0;
  const todayRatio = avgDaily > 0 ? todayTotalExpense / avgDaily : 0;

  const totalWeeks = weekDayCount / 7;
  const avgWeekly = totalWeeks > 0 ? quarterTotals.expense / totalWeeks : 0;
  const weekRatio = avgWeekly > 0 ? weekTotals.expense / avgWeekly : 0;

  const balance = computeBalanceSummary(totalsByType, dailyMap, today);

  const monthSummary: MonthSummary = {
    total: monthTotals.expense,
    budgetTotal: null,
    ratioToBudget: null,
  };

  let totalBudgetPlanned = 0;
  for (const budget of budgets) {
    totalBudgetPlanned += budget.planned ?? 0;
  }
  if (totalBudgetPlanned > 0) {
    monthSummary.budgetTotal = totalBudgetPlanned;
    monthSummary.ratioToBudget = monthTotals.expense / totalBudgetPlanned;
  }

  const categoryTotals = new Map<string | null, number>();
  for (const row of categoryRows) {
    const key = row.category_id ?? null;
    const current = categoryTotals.get(key) ?? 0;
    categoryTotals.set(key, current + parseNumber((row as { total?: number }).total));
  }

  const topCategories: TopCategoryItem[] = categoryRows
    .map((row) => {
      const total = parseNumber((row as { total?: number }).total);
      return {
        id: row.category_id ?? null,
        name: row.category?.name?.trim() || "Tanpa kategori",
        total,
        pctOfMonth: monthTotals.expense > 0 ? (total / monthTotals.expense) * 100 : 0,
      };
    })
    .filter((item) => item.total > 0)
    .slice(0, 3);

  const budgetWarnings = mapBudgets(budgets, categoryTotals);

  const upcomingSubscriptions = subscriptions
    .map((row) => ({
      id: row.id,
      name: row.name,
      dueDate: row.next_due_date ? String(row.next_due_date).slice(0, 10) : today,
      amount: row.amount ?? 0,
    }))
    .filter((item) => item.amount > 0)
    .slice(0, 5);

  const upcomingDebts = debts
    .map((row) => ({
      id: row.id,
      name: row.party_name ? `${row.title} • ${row.party_name}` : row.title,
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : today,
      amount: row.amount ?? 0,
    }))
    .filter((item) => item.amount > 0)
    .slice(0, 5);

  const todaySummary: TodayExpenseSummary = {
    total: todayTotalExpense,
    avgDaily,
    ratio: todayRatio,
  };

  const wtdSummary: PeriodSummary = {
    total: weekTotals.expense,
    average: avgWeekly,
    ratio: weekRatio,
  };

  const insight = buildInsight(todaySummary, wtdSummary, monthSummary, topCategories);

  return {
    balance,
    todayExpense: todaySummary,
    wtd: wtdSummary,
    mtd: monthSummary,
    topCategories,
    upcoming: {
      budgets: budgetWarnings,
      subscriptions: upcomingSubscriptions,
      debts: upcomingDebts,
    },
    insight,
    hasTodayTransactions: todayEntry.income > 0 || todayEntry.expense > 0,
  };
}

function loadCache(userId: string): DailyDigestData | null {
  const entry = memoryCache.get(userId);
  const now = Date.now();
  if (entry && entry.expiresAt > now) {
    return entry.data;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedDigest;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.expiresAt > now && parsed.data) {
      memoryCache.set(userId, parsed);
      return parsed.data;
    }
  } catch {
    return null;
  }
  return null;
}

function saveCache(userId: string, data: DailyDigestData): void {
  const payload: CachedDigest = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  memoryCache.set(userId, payload);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(payload));
  } catch {
    // ignore write error
  }
}

function mapError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "Gagal memuat data");
    return new Error(message);
  }
  return new Error("Gagal memuat data");
}

export default function useDailyDigest(): UseDailyDigestResult {
  const { addToast } = useToast() ?? { addToast: () => undefined };
  const [data, setData] = useState<DailyDigestData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const userIdRef = useRef<string | null>(null);
  const mountedRef = useRef<boolean>(true);

  const fetchData = useCallback(
    async (userId: string, silent = false) => {
      if (!userId) return;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const digest = await computeDigest(userId);
        if (!mountedRef.current) return;
        setData(digest);
        saveCache(userId, digest);
      } catch (err) {
        if (!mountedRef.current) return;
        const mapped = mapError(err);
        setError(mapped);
        if (!silent && typeof addToast === "function") {
          addToast(mapped.message, "error");
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [addToast],
  );

  const refresh = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    await fetchData(userId);
  }, [fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(async ({ data: authData, error: authError }) => {
        if (cancelled) return;
        if (authError) throw authError;
        const userId = authData.user?.id ?? null;
        userIdRef.current = userId;
        if (!userId) {
          setData(null);
          setLoading(false);
          return;
        }
        const cached = loadCache(userId);
        if (cached) {
          setData(cached);
          setLoading(false);
          fetchData(userId, true).catch(() => undefined);
          return;
        }
        await fetchData(userId);
      })
      .catch((err: PostgrestError | Error) => {
        if (cancelled) return;
        const mapped = mapError(err);
        setError(mapped);
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.id) {
        userIdRef.current = null;
        setData(null);
        setLoading(false);
        return;
      }
      userIdRef.current = session.user.id;
      fetchData(session.user.id).catch(() => undefined);
    });

    return () => {
      cancelled = true;
      subscription.subscription?.unsubscribe();
    };
  }, [fetchData]);

  const result = useMemo(
    () => ({
      data,
      loading,
      error,
      refresh,
    }),
    [data, loading, error, refresh],
  );

  return result;
}

