import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useDataMode } from '../providers/DataProvider';
import { loadSubscriptions, nextDue } from '../lib/subscriptions';
import {
  clampTimestamp,
  daysInMonth,
  differenceInDaysUtc,
  endOfDayZoned,
  startOfDayZoned,
  startOfMonthZoned,
  startOfWeekZoned,
  toZonedDate,
} from '../lib/timezone';

export type InsightType = 'trend' | 'budget' | 'good' | 'warn' | 'subs' | 'goal';
export type InsightSeverity = 'low' | 'med' | 'high';

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  message: string;
  meta?: Record<string, any>;
}

interface FallbackData {
  transactions?: Record<string, any>[];
  budgets?: Record<string, any>[];
  goals?: Record<string, any>[];
  subscriptions?: Record<string, any>[];
}

interface UseInsightsOptions {
  fallback?: FallbackData;
}

interface OnlineData {
  weeklyMerchant: Record<string, any>[];
  cashflow: Record<string, any>[];
  weeklyTop: Record<string, any>[];
  budgets: Record<string, any>[];
  goals: Record<string, any>[];
  subscriptions: Record<string, any>[];
  transactions: Record<string, any>[];
}

interface UseInsightsResult {
  insights: Insight[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

const TIMEZONE = 'Asia/Jakarta';
const severityRank: Record<InsightSeverity, number> = { high: 0, med: 1, low: 2 };
const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat('id-ID', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export default function useInsights(options: UseInsightsOptions = {}): UseInsightsResult {
  const { fallback } = options;
  const { mode } = useDataMode();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const localSubscriptions = useMemo(
    () => fallback?.subscriptions ?? loadSubscriptions(),
    [fallback?.subscriptions],
  );

  const fallbackData = useMemo(
    () => ({
      transactions: fallback?.transactions ?? [],
      budgets: fallback?.budgets ?? [],
      goals: fallback?.goals ?? [],
      subscriptions: localSubscriptions ?? [],
    }),
    [fallback?.transactions, fallback?.budgets, fallback?.goals, localSubscriptions],
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      let onlineData: OnlineData | null = null;

      try {
        if (mode === 'online') {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError) throw userError;
          const userId = userData.user?.id;
          if (userId) {
            onlineData = await fetchOnlineData(userId);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Gagal memuat insight'));
        }
      }

      const combined = buildInsights(onlineData, fallbackData);
      if (!cancelled) {
        setInsights(combined);
        setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [mode, refreshToken, fallbackData]);

  const refresh = () => setRefreshToken((token) => token + 1);

  return { insights, loading, error, refresh };
}

async function fetchOnlineData(userId: string): Promise<OnlineData> {
  const thirtyFiveDaysAgo = new Date();
  thirtyFiveDaysAgo.setUTCDate(thirtyFiveDaysAgo.getUTCDate() - 35);
  const fromIso = thirtyFiveDaysAgo.toISOString().slice(0, 10);

  const [weeklyMerchant, cashflow, weeklyTop, budgets, goals, subscriptions, transactions] = await Promise.all([
    fetchRows(
      supabase.from('v_tx_weekly_merchant').select('*').eq('user_id', userId).limit(40),
    ),
    fetchRows(
      supabase.from('v_tx_monthly_cashflow').select('*').eq('user_id', userId).limit(12),
    ),
    fetchRows(
      supabase.from('v_tx_weekly_top_category').select('*').eq('user_id', userId).limit(20),
      true,
    ),
    fetchRows(
      supabase
        .from('budgets')
        .select('id, period_month, planned, planned_amount, amount_planned, name, category, category_name, user_id')
        .eq('user_id', userId),
      true,
    ),
    fetchRows(
      supabase
        .from('goals')
        .select('id, title, target_amount, saved_amount, status, updated_at, created_at, user_id')
        .eq('user_id', userId),
      true,
    ),
    fetchRows(
      supabase
        .from('subscriptions')
        .select('id, name, amount, status, next_due_date, user_id')
        .eq('user_id', userId),
      true,
    ),
    fetchRows(
      supabase
        .from('transactions')
        .select('id, amount, type, date, merchant, merchant_name, category, category_name, deleted_at, user_id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('date', fromIso)
        .limit(500),
      true,
    ),
  ]);

  return {
    weeklyMerchant,
    cashflow,
    weeklyTop,
    budgets,
    goals,
    subscriptions,
    transactions,
  };
}

async function fetchRows<T>(query: any, optional = false): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    if (optional) return [];
    throw error;
  }
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function buildInsights(online: OnlineData | null, fallback: Required<FallbackData>): Insight[] {
  const transactions = online?.transactions?.length ? online.transactions : fallback.transactions;
  const budgets = online?.budgets?.length ? online.budgets : fallback.budgets;
  const goals = online?.goals?.length ? online.goals : fallback.goals;
  const subscriptions = online?.subscriptions?.length
    ? online.subscriptions
    : fallback.subscriptions ?? [];

  const weeklyMerchantRows = online?.weeklyMerchant?.length
    ? online.weeklyMerchant
    : buildWeeklyMerchantFromTransactions(transactions);
  const weeklyTopRows = online?.weeklyTop ?? [];
  const cashflowRows = online?.cashflow ?? [];

  const insightList: Insight[] = [];
  insightList.push(...generateMerchantTrendInsights(weeklyMerchantRows, weeklyTopRows));
  const burnInsight = generateBurnRateInsight(cashflowRows, budgets, transactions);
  if (burnInsight) insightList.push(burnInsight);
  const goodDayInsight = generateGoodDayInsight(transactions);
  if (goodDayInsight) insightList.push(goodDayInsight);
  const subscriptionInsight = generateSubscriptionInsight(
    online?.subscriptions ?? [],
    subscriptions,
  );
  if (subscriptionInsight) insightList.push(subscriptionInsight);
  insightList.push(...generateGoalInsights(goals));

  const decorated = insightList.map((item) => ({
    ...item,
    meta: {
      ...(item.meta ?? {}),
      timestamp: clampTimestamp(
        typeof item.meta?.timestamp === 'number'
          ? new Date(item.meta.timestamp)
          : toZonedDate(item.meta?.timestamp ?? Date.now(), TIMEZONE) ?? new Date(),
      ),
    },
  }));

  decorated.sort((a, b) => {
    const severityDiff = severityRank[a.severity] - severityRank[b.severity];
    if (severityDiff !== 0) return severityDiff;
    const aTime = clampTimestamp(a.meta?.timestamp ? new Date(a.meta.timestamp) : null);
    const bTime = clampTimestamp(b.meta?.timestamp ? new Date(b.meta.timestamp) : null);
    return bTime - aTime;
  });

  return decorated.slice(0, 5);
}

function buildWeeklyMerchantFromTransactions(transactions: Record<string, any>[]) {
  const map = new Map<string, { merchant: string; weekStart: Date; count: number; amount: number }>();

  for (const tx of transactions) {
    const type = String(tx.type || '').toLowerCase();
    if (type !== 'expense') continue;
    if (tx.deleted_at) continue;
    const merchant = pickString(tx, ['merchant', 'merchant_name', 'title', 'note']);
    if (!merchant) continue;
    const zonedDate = toZonedDate(tx.date, TIMEZONE);
    if (!zonedDate) continue;
    const weekStart = startOfWeekZoned(zonedDate, TIMEZONE);
    const key = `${merchant}::${weekStart.getTime()}`;
    if (!map.has(key)) {
      map.set(key, { merchant, weekStart, count: 0, amount: 0 });
    }
    const entry = map.get(key)!;
    entry.count += 1;
    entry.amount += Math.abs(pickNumber(tx, ['amount', 'value']));
  }

  return Array.from(map.values()).map((item) => ({
    merchant: item.merchant,
    week_start: item.weekStart,
    count: item.count,
    total: item.amount,
  }));
}

function generateMerchantTrendInsights(
  rows: Record<string, any>[],
  weeklyTop: Record<string, any>[],
): Insight[] {
  if (!rows.length) return [];

  const now = new Date();
  const currentWeekStart = startOfWeekZoned(now, TIMEZONE);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);

  const byMerchant = new Map<string, { weekStart: Date; count: number; amount: number }[]>();

  for (const row of rows) {
    const merchant = pickString(row, ['merchant', 'merchant_name', 'name', 'title']);
    if (!merchant) continue;
    const rowDate = pickDate(row, ['week_start', 'week', 'period', 'date']);
    if (!rowDate) continue;
    const weekStart = startOfWeekZoned(rowDate, TIMEZONE);
    const count = pickNumber(row, ['count', 'tx_count', 'transaction_count', 'freq']);
    const amount = Math.abs(pickNumber(row, ['total', 'total_amount', 'amount', 'sum', 'expense']));
    if (count <= 0 && amount <= 0) continue;
    const list = byMerchant.get(merchant) ?? [];
    list.push({ weekStart, count, amount });
    byMerchant.set(merchant, list);
  }

  const insights: Insight[] = [];

  for (const [merchant, entries] of byMerchant.entries()) {
    entries.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
    const current = entries.find(
      (entry) => entry.weekStart.getTime() === currentWeekStart.getTime(),
    );
    if (!current || current.count < 2) continue;
    const previous = entries.find(
      (entry) => entry.weekStart.getTime() === previousWeekStart.getTime(),
    );
    const previousCount = previous?.count ?? 0;
    const previousAmount = previous?.amount ?? 0;
    const countRatio = previousCount > 0 ? current.count / previousCount : Infinity;
    const amountRatio = previousAmount > 0 ? current.amount / previousAmount : Infinity;
    if (previousCount > 0 && countRatio < 1.5 && amountRatio < 1.5) continue;

    const severity: InsightSeverity = countRatio >= 2 || amountRatio >= 2 ? 'high' : 'med';
    const increasePct = previousCount > 0 ? countRatio - 1 : 1;
    const message = previousCount
      ? `Merchant ${merchant} lagi hits! Frekuensi naik ${percentFormatter.format(
          Math.min(increasePct, 2),
        )}. Dompet siap-siap?`
      : `Minggu ini kamu sering mampir ke ${merchant}. Jangan-jangan jadi pelanggan VIP!`;

    const topCategory = weeklyTop
      .map((row) => ({
        category: pickString(row, ['category', 'category_name', 'name']),
        total: pickNumber(row, ['total', 'total_amount', 'amount', 'sum']),
        date: pickDate(row, ['week_start', 'week', 'period', 'date']),
      }))
      .filter((item) => item.category && item.date)
      .sort((a, b) => (b.date!.getTime() ?? 0) - (a.date!.getTime() ?? 0))[0];

    insights.push({
      id: `trend-${merchant}`,
      type: 'trend',
      severity,
      message,
      meta: {
        merchant,
        currentCount: current.count,
        previousCount,
        ratio: countRatio,
        timestamp: current.weekStart,
        hint: topCategory
          ? `Kategori teratas minggu ini: ${topCategory.category}`
          : undefined,
      },
    });
  }

  return insights.slice(0, 2);
}

function generateBurnRateInsight(
  cashflowRows: Record<string, any>[],
  budgets: Record<string, any>[],
  transactions: Record<string, any>[],
): Insight | null {
  const now = new Date();
  const monthStart = startOfMonthZoned(now, TIMEZONE);
  const todayStart = startOfDayZoned(now, TIMEZONE);
  const elapsedDays = Math.max(1, differenceInDaysUtc(todayStart, monthStart) + 1);
  const totalDays = daysInMonth(monthStart);

  let spent = 0;
  for (const row of cashflowRows) {
    const rowDate = pickDate(row, ['month_start', 'period_month', 'month', 'date']);
    if (!rowDate) continue;
    if (!isSameMonth(rowDate, monthStart)) continue;
    const value = Math.abs(
      pickNumber(row, ['expense', 'spent', 'outflow', 'total_expense', 'amount_expense']),
    );
    if (value > spent) {
      spent = value;
    }
  }

  if (spent === 0) {
    spent = transactions
      .filter((tx) => String(tx.type || '').toLowerCase() === 'expense')
      .filter((tx) => !tx.deleted_at)
      .reduce((total, tx) => {
        const date = toZonedDate(tx.date, TIMEZONE);
        if (!date || !isSameMonth(date, monthStart)) return total;
        return total + Math.abs(pickNumber(tx, ['amount', 'value']));
      }, 0);
  }

  const planned = budgets.reduce((total, budget) => {
    const date = pickMonth(budget, ['period_month', 'month', 'month_start']);
    if (date && isSameMonth(date, monthStart)) {
      total += Math.abs(
        pickNumber(budget, ['planned', 'planned_amount', 'amount_planned', 'limit', 'cap']),
      );
    }
    return total;
  }, 0);

  if (planned <= 0) return null;

  const spentPerDay = spent / elapsedDays;
  const plannedPerDay = planned / totalDays;
  if (plannedPerDay <= 0) return null;

  const ratio = spentPerDay / plannedPerDay;
  if (ratio <= 1) return null;

  const severity: InsightSeverity = ratio >= 1.25 ? 'high' : 'med';
  const message = `Burn rate ${Math.round(ratio * 100)}% dari target. Saatnya tarik rem belanja!`;

  return {
    id: 'burn-rate',
    type: 'budget',
    severity,
    message,
    meta: {
      timestamp: todayStart,
      spent,
      planned,
      hint: `${currencyFormatter.format(spent)} dipakai dari ${currencyFormatter.format(planned)}`,
    },
  };
}

function generateGoodDayInsight(transactions: Record<string, any>[]): Insight | null {
  if (!transactions.length) return null;
  const now = new Date();
  const todayStart = startOfDayZoned(now, TIMEZONE);
  const startWindow = new Date(todayStart);
  startWindow.setUTCDate(startWindow.getUTCDate() - 14);

  const totals = new Map<number, number>();

  for (const tx of transactions) {
    if (String(tx.type || '').toLowerCase() !== 'expense') continue;
    if (tx.deleted_at) continue;
    const date = toZonedDate(tx.date, TIMEZONE);
    if (!date) continue;
    if (date < startWindow || date > endOfDayZoned(now, TIMEZONE)) continue;
    const dayStart = startOfDayZoned(date, TIMEZONE);
    const key = dayStart.getTime();
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(pickNumber(tx, ['amount', 'value'])));
  }

  const todayKey = todayStart.getTime();
  const todayTotal = totals.get(todayKey) ?? 0;

  let sum = 0;
  let days = 0;
  for (let i = 1; i <= 14; i += 1) {
    const day = new Date(todayStart);
    day.setUTCDate(day.getUTCDate() - i);
    const key = day.getTime();
    sum += totals.get(key) ?? 0;
    days += 1;
  }

  if (days === 0) return null;
  const average = sum / days;
  if (average <= 0) return null;
  if (todayTotal >= average) return null;

  const message = `Dompet senyum: belanja hari ini cuma ${currencyFormatter.format(
    todayTotal,
  )}, di bawah rata-rata ${currencyFormatter.format(average)}.`;

  return {
    id: 'good-day',
    type: 'good',
    severity: 'low',
    message,
    meta: {
      timestamp: todayStart,
      todayTotal,
      average,
    },
  };
}

function generateSubscriptionInsight(
  onlineSubs: Record<string, any>[],
  fallbackSubs: Record<string, any>[],
): Insight | null {
  const now = new Date();
  const todayStart = startOfDayZoned(now, TIMEZONE);
  const limit = new Date(todayStart);
  limit.setUTCDate(limit.getUTCDate() + 3);

  const candidates: { name: string; dueDate: Date; amount: number; status: string }[] = [];

  for (const sub of onlineSubs) {
    const status = pickString(sub, ['status']);
    if (status && status !== 'active') continue;
    const dueDate = pickDate(sub, ['next_due_date', 'due_date']);
    if (!dueDate) continue;
    const dueStart = startOfDayZoned(dueDate, TIMEZONE);
    if (dueStart > limit) continue;
    const amount = Math.abs(pickNumber(sub, ['amount', 'due_amount', 'value']));
    const name = pickString(sub, ['name', 'title', 'vendor']);
    if (!name) continue;
    candidates.push({ name, dueDate: dueStart, amount, status: status || 'active' });
  }

  if (!candidates.length) {
    for (const sub of fallbackSubs) {
      const name = pickString(sub, ['name', 'title']);
      if (!name) continue;
      const due = nextDue(sub);
      const dueStart = startOfDayZoned(due, TIMEZONE);
      if (dueStart > limit) continue;
      const amount = Math.abs(pickNumber(sub, ['amount', 'value']));
      candidates.push({ name, dueDate: dueStart, amount, status: 'active' });
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const next = candidates[0];
  const diff = differenceInDaysUtc(next.dueDate, todayStart);

  if (diff > 3) return null;

  const dayLabel = diff < 0 ? `telat ${Math.abs(diff)} hari` : diff === 0 ? 'hari ini' : diff === 1 ? 'besok' : `dalam ${diff} hari`;
  const severity: InsightSeverity = diff < 0 ? 'high' : 'med';
  const message = `Langganan ${next.name} jatuh tempo ${dayLabel}. Siapkan ${currencyFormatter.format(
    next.amount,
  )}.`;

  return {
    id: `subs-${next.name}`,
    type: 'subs',
    severity,
    message,
    meta: {
      timestamp: next.dueDate,
      hint: `Jatuh tempo ${next.dueDate.toLocaleDateString('id-ID')}`,
    },
  };
}

function generateGoalInsights(goals: Record<string, any>[]): Insight[] {
  const milestones = [1, 0.75, 0.5, 0.25];
  const items = goals
    .map((goal) => {
      const status = pickString(goal, ['status']);
      if (status && ['archived', 'paused'].includes(status)) return null;
      const target = Math.abs(pickNumber(goal, ['target_amount', 'target']));
      if (target <= 0) return null;
      const saved = Math.abs(pickNumber(goal, ['saved_amount', 'saved']));
      const progress = target > 0 ? saved / target : 0;
      if (progress < 0.25) return null;
      const milestone = milestones.find((m) => progress >= m);
      if (!milestone) return null;
      const severity: InsightSeverity = milestone >= 0.75 ? 'med' : 'low';
      const percentValue = Math.min(1, progress);
      const title = pickString(goal, ['title', 'name']);
      const cappedMilestone = Math.round(milestone * 100);
      const timestamp = pickDate(goal, ['updated_at', 'created_at']) ?? new Date();
      const message =
        milestone >= 1
          ? `Goal ${title || 'tabungan'} tuntas! Saatnya rayakan tanpa bikin saldo stres.`
          : `Goal ${title || 'tabungan'} sudah tembus ${percentFormatter.format(
              percentValue,
            )}. Gas terus!`;

      return {
        id: `goal-${goal.id ?? title}-${cappedMilestone}`,
        type: 'goal' as const,
        severity,
        message,
        meta: {
          timestamp,
          progress,
          hint: `${currencyFormatter.format(saved)} dari ${currencyFormatter.format(target)}`,
        },
      } satisfies Insight;
    })
    .filter(Boolean) as Insight[];

  items.sort((a, b) => {
    const aProgress = (a.meta?.progress as number | undefined) ?? 0;
    const bProgress = (b.meta?.progress as number | undefined) ?? 0;
    return bProgress - aProgress;
  });

  return items.slice(0, 2);
}

function pickString(row: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function pickNumber(row: Record<string, any>, keys: string[]): number {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

function pickDate(row: Record<string, any>, keys: string[]): Date | null {
  for (const key of keys) {
    const value = row?.[key];
    if (!value) continue;
    const date = toZonedDate(value, TIMEZONE);
    if (date) return date;
  }
  return null;
}

function pickMonth(row: Record<string, any>, keys: string[]): Date | null {
  for (const key of keys) {
    const value = row?.[key];
    if (!value) continue;
    if (value instanceof Date) {
      return startOfMonthZoned(value, TIMEZONE);
    }
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.length === 7 ? `${value}-01` : value;
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) {
        return startOfMonthZoned(parsed, TIMEZONE);
      }
    }
  }
  return null;
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}
