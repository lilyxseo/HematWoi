import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type InsightType = "trend" | "budget" | "good" | "warn" | "subs" | "goal";
export type InsightSeverity = "low" | "med" | "high";

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  message: string;
  meta?: Record<string, unknown>;
}

interface UseInsightsState {
  insights: Insight[];
  loading: boolean;
  error: Error | null;
}

const TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta (UTC+7)
const CURRENCY = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const MONTH_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
});

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  high: 3,
  med: 2,
  low: 1,
};

function toJakarta(date: Date): Date {
  return new Date(date.getTime() + TIMEZONE_OFFSET_MS);
}

function fromJakarta(date: Date): Date {
  return new Date(date.getTime() - TIMEZONE_OFFSET_MS);
}

function startOfJakartaDay(date: Date): Date {
  const zoned = toJakarta(date);
  zoned.setHours(0, 0, 0, 0);
  return fromJakarta(zoned);
}

function startOfJakartaWeek(date: Date): Date {
  const zoned = toJakarta(date);
  const day = zoned.getDay();
  const diff = (day + 6) % 7; // Monday as first day of week
  zoned.setDate(zoned.getDate() - diff);
  zoned.setHours(0, 0, 0, 0);
  return fromJakarta(zoned);
}

function startOfJakartaMonth(date: Date): Date {
  const zoned = toJakarta(date);
  zoned.setDate(1);
  zoned.setHours(0, 0, 0, 0);
  return fromJakarta(zoned);
}

function addJakartaDays(date: Date, amount: number): Date {
  const zoned = toJakarta(date);
  zoned.setDate(zoned.getDate() + amount);
  return fromJakarta(zoned);
}

function formatJakartaDate(date: Date): string {
  return DATE_FORMATTER.format(date);
}

function formatJakartaMonth(date: Date): string {
  return MONTH_FORMATTER.format(date);
}

function pickNumber(row: Record<string, any>, keys: string[]): number {
  for (const key of keys) {
    const value = row?.[key];
    if (value == null) continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return 0;
}

function pickString(row: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickDate(row: Record<string, any>, keys: string[]): Date | null {
  for (const key of keys) {
    const value = row?.[key];
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

async function fetchRows<T>(builder: () => Promise<{ data: T[] | null; error: any }>): Promise<T[]> {
  const { data, error } = await builder();
  if (error) {
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

async function fetchWeeklyMerchant() {
  return fetchRows(() => supabase.from("v_tx_weekly_merchant").select("*"));
}

async function fetchMonthlyCashflow() {
  return fetchRows(() => supabase.from("v_tx_monthly_cashflow").select("*"));
}

async function fetchWeeklyTopCategory() {
  return fetchRows(() => supabase.from("v_tx_weekly_top_category").select("*"));
}

async function fetchBudgets(monthStart: string) {
  return fetchRows(() =>
    supabase
      .from("budgets")
      .select("id, planned, rollover_in, rollover_out, period_month")
      .eq("period_month", monthStart)
  );
}

async function fetchRecentExpenses(start: string, end: string) {
  return fetchRows(() =>
    supabase
      .from("transactions")
      .select("id, amount, date, type")
      .eq("type", "expense")
      .is("deleted_at", null)
      .gte("date", start)
      .lte("date", end)
  );
}

async function fetchSubscriptions(today: string, cutoff: string) {
  return fetchRows(() =>
    supabase
      .from("subscriptions")
      .select("id, name, vendor, amount, currency, next_due_date, status")
      .eq("status", "active")
      .not("next_due_date", "is", null)
      .gte("next_due_date", today)
      .lte("next_due_date", cutoff)
  );
}

async function fetchGoals() {
  return fetchRows(() =>
    supabase
      .from("goals")
      .select("id, title, target_amount, saved_amount, updated_at, status")
      .eq("status", "active")
  );
}

interface InsightCandidate extends Insight {
  meta?: Record<string, unknown> & { timestamp?: number };
}

function createMerchantTrendInsights(rows: any[], now: Date): InsightCandidate[] {
  if (!Array.isArray(rows) || !rows.length) return [];
  const currentWeekStart = startOfJakartaWeek(now);
  const prevWeekStart = addJakartaDays(currentWeekStart, -7);
  const currentKey = formatJakartaDate(currentWeekStart);
  const prevKey = formatJakartaDate(prevWeekStart);
  const merchantMap = new Map<string, Map<string, { count: number; total: number }>>();

  for (const row of rows) {
    const merchant =
      pickString(row, ["merchant", "merchant_name", "name", "title"]) ?? "";
    if (!merchant) continue;
    const weekDate =
      pickDate(row, ["week_start", "period_start", "period", "date", "week"]) ?? null;
    if (!weekDate) continue;
    const weekKey = formatJakartaDate(startOfJakartaWeek(weekDate));
    const count = pickNumber(row, ["count", "tx_count", "transaction_count", "frequency"]);
    const total = Math.abs(
      pickNumber(row, ["total", "total_amount", "amount", "sum", "spending"])
    );
    if (count <= 0) continue;
    const weekEntries = merchantMap.get(merchant) ?? new Map();
    weekEntries.set(weekKey, { count, total });
    merchantMap.set(merchant, weekEntries);
  }

  const results: InsightCandidate[] = [];
  for (const [merchant, weeks] of merchantMap.entries()) {
    const current = weeks.get(currentKey);
    const previous = weeks.get(prevKey);
    if (!current || !previous) continue;
    if (current.count < 2 || previous.count <= 0) continue;
    const diff = current.count - previous.count;
    if (diff <= 0) continue;
    const pctIncrease = (diff / previous.count) * 100;
    if (pctIncrease < 50) continue;
    const severity: InsightSeverity = pctIncrease >= 100 || current.total >= 750_000 ? "high" : "med";
    const message = `⚠️ ${merchant} lagi rame: transaksi naik ${pctIncrease.toFixed(0)}% minggu ini. Dompet mulai ngos-ngosan?`;
    results.push({
      id: `trend-merchant-${merchant.toLowerCase()}`,
      type: "trend",
      severity,
      message,
      meta: {
        merchant,
        currentCount: current.count,
        previousCount: previous.count,
        increasePct: pctIncrease,
        totalAmount: current.total,
        timestamp: currentWeekStart.getTime(),
      },
    });
  }
  return results;
}

function extractCashflowForMonth(rows: any[], monthKey: string) {
  for (const row of rows) {
    const rawKey =
      pickString(row, ["month", "period_month", "month_start", "period", "label"]) ?? "";
    let key = rawKey.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) {
      const parsed = pickDate(row, ["month", "period_month", "month_start", "period"]);
      if (parsed) {
        key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      }
    }
    if (!key) continue;
    if (key === monthKey) {
      const income = pickNumber(row, ["income", "inflow", "earnings", "total_income"]);
      const expense = Math.abs(
        pickNumber(row, ["expense", "expenses", "outflow", "spending", "total_expense"])
      );
      const net = pickNumber(row, ["net", "balance", "surplus", "deficit"]);
      return { income, expense, net };
    }
  }
  return null;
}

function createBurnRateInsight(
  cashflowRows: any[],
  budgetRows: any[],
  now: Date,
  monthStart: Date
): InsightCandidate | null {
  const monthKey = formatJakartaMonth(monthStart);
  const cashflow = extractCashflowForMonth(cashflowRows, monthKey);
  if (!cashflow) return null;
  const planned = budgetRows.reduce((sum, row) => {
    const base = Number(row?.planned ?? 0);
    const rolloverIn = Number(row?.rollover_in ?? 0);
    const rolloverOut = Number(row?.rollover_out ?? 0);
    return sum + base + rolloverIn - rolloverOut;
  }, 0);
  if (planned <= 0) return null;

  const zonedNow = toJakarta(now);
  const daysElapsed = zonedNow.getDate();
  const daysInMonth = new Date(zonedNow.getFullYear(), zonedNow.getMonth() + 1, 0).getDate();
  if (daysElapsed <= 0 || daysInMonth <= 0) return null;

  const spent = cashflow.expense;
  if (spent <= 0) return null;

  const burnRate = spent / daysElapsed;
  const plannedRate = planned / daysInMonth;
  if (burnRate <= plannedRate) return null;

  const projected = burnRate * daysInMonth;
  const overPct = ((projected - planned) / planned) * 100;
  const severity: InsightSeverity = overPct >= 20 ? "high" : "med";
  const message = `🔥 Burn rate ngebut! Perkiraan akhir bulan ${CURRENCY.format(projected)} vs budget ${CURRENCY.format(planned)}. Saatnya rem tangan.`;
  return {
    id: "budget-burn-rate",
    type: "budget",
    severity,
    message,
    meta: {
      projected,
      planned,
      overPct,
      daysElapsed,
      daysInMonth,
      timestamp: now.getTime(),
    },
  };
}

function createGoodDayInsight(rows: any[], now: Date): InsightCandidate | null {
  if (!Array.isArray(rows)) return null;
  const totals = new Map<string, number>();
  const todayStart = startOfJakartaDay(now);
  for (const row of rows) {
    const date = pickDate(row, ["date", "created_at", "day"]);
    if (!date) continue;
    const key = formatJakartaDate(date);
    const amount = Math.abs(pickNumber(row, ["amount", "total", "value"]));
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }

  let total = 0;
  const days = 14;
  for (let i = 0; i < days; i += 1) {
    const dayKey = formatJakartaDate(addJakartaDays(todayStart, -i));
    total += totals.get(dayKey) ?? 0;
  }
  if (total <= 0) return null;
  const todayKey = formatJakartaDate(now);
  const todaySpend = totals.get(todayKey) ?? 0;
  const avg = total / days;
  if (todaySpend >= avg) return null;

  const message = `😎 Dompet santai! Hari ini cuma kebakar ${CURRENCY.format(todaySpend)} (rata-rata ${CURRENCY.format(avg)}). Boleh traktir es teh manis.`;
  return {
    id: "good-today",
    type: "good",
    severity: "low",
    message,
    meta: {
      todaySpend,
      average14: avg,
      timestamp: todayStart.getTime(),
    },
  };
}

function createSubscriptionInsight(rows: any[], now: Date): InsightCandidate | null {
  if (!Array.isArray(rows) || !rows.length) return null;
  const zonedNow = toJakarta(now);
  zonedNow.setHours(0, 0, 0, 0);

  let candidate: {
    id: string;
    name: string;
    amount: number;
    dueDate: Date;
  } | null = null;

  for (const row of rows) {
    const due = pickDate(row, ["next_due_date", "due_date"]);
    if (!due) continue;
    const amount = Math.abs(pickNumber(row, ["amount", "due_amount", "total"]));
    const name =
      pickString(row, ["name", "title", "subscription_name", "vendor"]) ?? "langganan misterius";
    const rowId = String(row?.id ?? name);
    const dueZoned = toJakarta(due);
    dueZoned.setHours(0, 0, 0, 0);
    if (!candidate || dueZoned.getTime() < candidate.dueDate.getTime()) {
      candidate = { id: rowId, name, amount, dueDate: dueZoned };
    }
  }

  if (!candidate) return null;
  const diffDays = Math.round(
    (candidate.dueDate.getTime() - zonedNow.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays > 3) return null;
  const when =
    diffDays <= 0
      ? "hari ini"
      : diffDays === 1
        ? "besok"
        : `dalam ${diffDays} hari`;
  const message = `📅 ${candidate.name} jatuh tempo ${when}. Siapkan ${CURRENCY.format(candidate.amount)} biar langganan tetap jalan.`;
  const severity: InsightSeverity = diffDays <= 0 ? "high" : "med";
  return {
    id: `subs-${candidate.id}`,
    type: "subs",
    severity,
    message,
    meta: {
      dueDate: candidate.dueDate.toISOString(),
      amount: candidate.amount,
      timestamp: candidate.dueDate.getTime(),
    },
  };
}

function createGoalInsights(rows: any[]): InsightCandidate[] {
  if (!Array.isArray(rows) || !rows.length) return [];
  const thresholds: { pct: number; label: string; severity: InsightSeverity }[] = [
    { pct: 1, label: "100%", severity: "med" },
    { pct: 0.75, label: "75%", severity: "med" },
    { pct: 0.5, label: "50%", severity: "low" },
    { pct: 0.25, label: "25%", severity: "low" },
  ];

  return rows
    .map((row) => {
      const target = Math.max(0, Number(row?.target_amount ?? row?.target ?? 0));
      const saved = Math.max(0, Number(row?.saved_amount ?? row?.saved ?? 0));
      if (target <= 0) return null;
      const pct = target ? saved / target : 0;
      const milestone = thresholds.find((item) => pct >= item.pct);
      if (!milestone) return null;
      const title = pickString(row, ["title", "name"]) ?? "Goal rahasia";
      const message = milestone.pct >= 1
        ? `🎉 Goal "${title}" sudah tuntas! Saatnya rayakan tanpa bon panjang.`
        : `🎯 Goal "${title}" sudah tembus ${milestone.label}. Pelan-pelan, sultan mulai terlihat.`;
      const updatedAt = pickDate(row, ["updated_at", "created_at"])?.getTime();
      return {
        id: `goal-${row?.id ?? title}-${milestone.label}`,
        type: "goal" as const,
        severity: milestone.severity,
        message,
        meta: {
          percent: pct * 100,
          milestone: milestone.label,
          timestamp: updatedAt ?? Date.now(),
        },
      } satisfies InsightCandidate;
    })
    .filter(Boolean) as InsightCandidate[];
}

function createTopCategoryInsight(rows: any[], now: Date): InsightCandidate | null {
  if (!Array.isArray(rows) || !rows.length) return null;
  const currentWeekStart = startOfJakartaWeek(now);
  const currentKey = formatJakartaDate(currentWeekStart);
  let best: { category: string; total: number; timestamp: number } | null = null;

  for (const row of rows) {
    const category = pickString(row, ["category", "category_name", "name", "label"]);
    if (!category) continue;
    const total = Math.abs(
      pickNumber(row, ["total", "total_amount", "amount", "sum", "spending"])
    );
    if (total <= 0) continue;
    const weekDate = pickDate(row, ["week_start", "period_start", "period", "date", "week"]);
    let timestamp = currentWeekStart.getTime();
    if (weekDate) {
      const key = formatJakartaDate(startOfJakartaWeek(weekDate));
      if (key !== currentKey) continue;
      timestamp = startOfJakartaWeek(weekDate).getTime();
    }
    if (!best || total > best.total) {
      best = { category, total, timestamp };
    }
  }

  if (!best) return null;
  const message = `📊 Kategori ${best.category} juara minggu ini dengan ${CURRENCY.format(best.total)}. Worth it kah?`;
  return {
    id: `trend-category-${best.category.toLowerCase()}`,
    type: "trend",
    severity: "low",
    message,
    meta: {
      category: best.category,
      amount: best.total,
      timestamp: best.timestamp,
    },
  };
}

function createCashflowInsight(rows: any[], now: Date, monthStart: Date): InsightCandidate | null {
  const monthKey = formatJakartaMonth(monthStart);
  const cashflow = extractCashflowForMonth(rows, monthKey);
  if (!cashflow) return null;
  const net = cashflow.net || cashflow.income - cashflow.expense;
  if (!net) return null;
  if (net > 0) {
    const message = `💰 Cashflow bulan ini surplus ${CURRENCY.format(net)}. Dompet kasih jempol dua!`;
    return {
      id: "cashflow-positive",
      type: "good",
      severity: "low",
      message,
      meta: {
        net,
        timestamp: now.getTime(),
      },
    };
  }
  const deficit = Math.abs(net);
  const message = `🧯 Cashflow bulan ini minus ${CURRENCY.format(deficit)}. Jangan sampai api membesar!`;
  return {
    id: "cashflow-negative",
    type: "warn",
    severity: "med",
    message,
    meta: {
      net: -deficit,
      timestamp: now.getTime(),
    },
  };
}

function sortInsights(items: InsightCandidate[]): Insight[] {
  const sorted = [...items].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (severityDiff !== 0) return severityDiff;
    const aTime = typeof a.meta?.timestamp === "number" ? a.meta.timestamp : 0;
    const bTime = typeof b.meta?.timestamp === "number" ? b.meta.timestamp : 0;
    return bTime - aTime;
  });
  return sorted.slice(0, 5).map((item) => ({
    id: item.id,
    type: item.type,
    severity: item.severity,
    message: item.message,
    meta: item.meta,
  }));
}

export default function useInsights(): UseInsightsState {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const monthStart = startOfJakartaMonth(now);
        const todayStart = startOfJakartaDay(now);
        const rangeStart = addJakartaDays(todayStart, -13);
        const dueCutoff = addJakartaDays(todayStart, 3);

        const tasks = [
          { key: "weeklyMerchant", promise: fetchWeeklyMerchant() },
          { key: "cashflow", promise: fetchMonthlyCashflow() },
          { key: "weeklyTop", promise: fetchWeeklyTopCategory() },
          { key: "budgets", promise: fetchBudgets(formatJakartaDate(monthStart)) },
          {
            key: "expenses",
            promise: fetchRecentExpenses(
              formatJakartaDate(rangeStart),
              formatJakartaDate(now)
            ),
          },
          {
            key: "subscriptions",
            promise: fetchSubscriptions(
              formatJakartaDate(todayStart),
              formatJakartaDate(dueCutoff)
            ),
          },
          { key: "goals", promise: fetchGoals() },
        ] as const;

        const settled = await Promise.allSettled(tasks.map((task) => task.promise));
        const data: Record<string, any> = {};
        let firstError: Error | null = null;
        settled.forEach((result, index) => {
          if (result.status === "fulfilled") {
            data[tasks[index].key] = result.value;
          } else if (!firstError) {
            const err = result.reason instanceof Error
              ? result.reason
              : new Error(String(result.reason ?? "Unknown error"));
            firstError = err;
          }
        });

        const candidates: InsightCandidate[] = [];
        candidates.push(
          ...createMerchantTrendInsights(data.weeklyMerchant ?? [], now)
        );
        const burn = createBurnRateInsight(
          data.cashflow ?? [],
          data.budgets ?? [],
          now,
          monthStart
        );
        if (burn) candidates.push(burn);
        const good = createGoodDayInsight(data.expenses ?? [], now);
        if (good) candidates.push(good);
        const subs = createSubscriptionInsight(data.subscriptions ?? [], now);
        if (subs) candidates.push(subs);
        candidates.push(...createGoalInsights(data.goals ?? []));
        const topCategory = createTopCategoryInsight(data.weeklyTop ?? [], now);
        if (topCategory) candidates.push(topCategory);
        const cashflowInsight = createCashflowInsight(data.cashflow ?? [], now, monthStart);
        if (cashflowInsight) candidates.push(cashflowInsight);

        const finalInsights = sortInsights(candidates);
        if (!cancelled) {
          setInsights(finalInsights);
          setError(firstError);
        }
      } catch (err) {
        if (!cancelled) {
          setInsights([]);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({ insights, loading, error }),
    [insights, loading, error]
  );
}
