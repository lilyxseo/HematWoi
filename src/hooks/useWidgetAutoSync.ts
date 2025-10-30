import { useEffect, useMemo, useRef } from 'react';
import type {
  WidgetBudgetPayload,
  WidgetCalendarPayload,
  WidgetGoalPayload,
  WidgetStatsPayload,
  WidgetSummaryPayload,
  WidgetStatsDailyEntry,
} from '../lib/native/widget';
import {
  updateBudgetWidget,
  updateCalendarWidget,
  updateGoalWidget,
  updateStatsWidget,
  updateSummaryWidget,
} from '../lib/native/widget';
import { isAndroid, isNativePlatform } from '../lib/native';

type TransactionLike = {
  id?: string;
  type?: string;
  date?: string | Date | null;
  amount?: number | string | null;
};

type BudgetLike = {
  month?: string | null;
  amount_planned?: number | string | null;
};

type GoalLike = {
  title?: string;
  name?: string;
  target_amount?: number | string | null;
  target?: number | string | null;
  saved_amount?: number | string | null;
  saved?: number | string | null;
  status?: string | null;
};

type WidgetSyncOptions = {
  transactions?: TransactionLike[];
  currency?: string;
  budgets?: BudgetLike[];
  goals?: GoalLike[];
};

const jakartaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
});

function resolveDateISO(input?: string | Date | null): string | null {
  if (!input) return null;
  if (typeof input === 'string') {
    if (input.length >= 10) return input.slice(0, 10);
    return input;
  }
  try {
    return input.toISOString().slice(0, 10);
  } catch (error) {
    console.warn('[widget] Failed to normalize date', error);
    return null;
  }
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function computeTodaySummary(transactions: TransactionLike[], currency: string | undefined): WidgetSummaryPayload {
  const todayIso = jakartaFormatter.format(new Date());
  let income = 0;
  let expense = 0;
  let count = 0;

  for (const tx of transactions) {
    if (!tx || tx.type === 'transfer') continue;
    const txDate = resolveDateISO(tx.date);
    if (txDate !== todayIso) continue;
    const rawAmount = typeof tx.amount === 'string' ? Number(tx.amount) : Number(tx.amount ?? 0);
    if (!Number.isFinite(rawAmount)) continue;
    const amount = Math.max(0, Math.round(rawAmount));
    if (tx.type === 'income') {
      income += amount;
      count += 1;
    } else if (tx.type === 'expense') {
      expense += amount;
      count += 1;
    }
  }

  const net = income - expense;
  return {
    dateISO: todayIso,
    currency: currency || 'IDR',
    incomeToday: income,
    expenseToday: expense,
    netToday: net,
    countTxToday: count,
    updatedAt: Date.now(),
  };
}

function computeBudgetSnapshot(
  transactions: TransactionLike[] | undefined,
  budgets: BudgetLike[] | undefined,
  currency: string | undefined
): WidgetBudgetPayload {
  const monthIso = new Date().toISOString().slice(0, 7);
  const totalBudget = (budgets ?? [])
    .filter((item) => (item?.month ?? '').slice(0, 7) === monthIso)
    .reduce((sum, item) => sum + toNumber(item?.amount_planned), 0);
  const expenseToDate = (transactions ?? [])
    .filter((tx) => tx?.type === 'expense' && resolveDateISO(tx.date)?.startsWith(monthIso))
    .reduce((sum, tx) => sum + Math.max(0, toNumber(tx.amount)), 0);
  return {
    month: monthIso,
    currency: currency || 'IDR',
    totalBudget,
    expenseToDate,
    updatedAt: Date.now(),
  };
}

function computeGoalSnapshot(goals: GoalLike[] | undefined, currency: string | undefined): WidgetGoalPayload {
  if (!goals || goals.length === 0) {
    return {
      name: 'Belum ada goal',
      currency: currency || 'IDR',
      targetAmount: 0,
      savedAmount: 0,
      updatedAt: Date.now(),
    };
  }
  const preferred = goals.find((goal) => {
    const status = goal?.status?.toLowerCase?.() ?? 'active';
    return status !== 'archived' && status !== 'achieved';
  }) ?? goals[0];
  const target = toNumber(preferred?.target_amount ?? preferred?.target);
  const saved = toNumber(preferred?.saved_amount ?? preferred?.saved);
  const name = (preferred?.title || preferred?.name || '').trim() || 'Goal';
  return {
    name,
    currency: currency || 'IDR',
    targetAmount: target,
    savedAmount: saved,
    updatedAt: Date.now(),
  };
}

function computeCalendarSnapshot(transactions: TransactionLike[] | undefined): WidgetCalendarPayload {
  const today = new Date();
  const monthIso = today.toISOString().slice(0, 7);
  const highlightsMap = new Map<string, number>();
  (transactions ?? []).forEach((tx) => {
    if (!tx || tx.type !== 'expense') return;
    const dateIso = resolveDateISO(tx.date);
    if (!dateIso || !dateIso.startsWith(monthIso)) return;
    const amount = Math.max(0, toNumber(tx.amount));
    highlightsMap.set(dateIso, (highlightsMap.get(dateIso) ?? 0) + amount);
  });
  const amounts = Array.from(highlightsMap.values());
  const maxAmount = Math.max(0, ...amounts);
  const highlights = Array.from(highlightsMap.entries())
    .map(([date, amount]) => ({
      date,
      intensity: maxAmount === 0 ? 0 : resolveIntensity(amount / maxAmount),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    month: monthIso,
    highlights,
    updatedAt: Date.now(),
  };
}

function resolveIntensity(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  if (ratio >= 0.85) return 3;
  if (ratio >= 0.55) return 2;
  if (ratio >= 0.25) return 1;
  return 0;
}

function computeStatsSnapshot(
  transactions: TransactionLike[] | undefined,
  currency: string | undefined
): WidgetStatsPayload {
  const today = new Date();
  const monthIso = today.toISOString().slice(0, 7);
  let income = 0;
  let expense = 0;
  const dailyMap = new Map<string, number>();
  (transactions ?? []).forEach((tx) => {
    const dateIso = resolveDateISO(tx?.date);
    if (!dateIso) return;
    const amount = Math.max(0, toNumber(tx?.amount));
    if (dateIso.startsWith(monthIso)) {
      if (tx?.type === 'income') income += amount;
      if (tx?.type === 'expense') expense += amount;
    }
    if (tx?.type === 'expense') {
      dailyMap.set(dateIso, (dailyMap.get(dateIso) ?? 0) + amount);
    }
  });
  const daily: WidgetStatsDailyEntry[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const iso = jakartaFormatter.format(date);
    daily.push({
      date: iso,
      expense: dailyMap.get(iso) ?? 0,
    });
  }
  return {
    month: monthIso,
    currency: currency || 'IDR',
    income,
    expense,
    daily,
    updatedAt: Date.now(),
  };
}

export function useWidgetAutoSync(options: WidgetSyncOptions): void {
  const { transactions = [], currency, budgets = [], goals = [] } = options;
  const isNativeAndroid = isNativePlatform() && isAndroid();

  const summarySignatureRef = useRef<string>('');
  const budgetSignatureRef = useRef<string>('');
  const goalSignatureRef = useRef<string>('');
  const calendarSignatureRef = useRef<string>('');
  const statsSignatureRef = useRef<string>('');

  const summaryPayload = useMemo(
    () => computeTodaySummary(transactions, currency),
    [transactions, currency]
  );

  useEffect(() => {
    if (!isNativeAndroid) return;
    const handle = window.setTimeout(() => {
      const signature = JSON.stringify({ ...summaryPayload, updatedAt: 0 });
      if (summarySignatureRef.current === signature) return;
      summarySignatureRef.current = signature;
      void updateSummaryWidget(summaryPayload);
    }, 400);
    return () => {
      window.clearTimeout(handle);
    };
  }, [summaryPayload, isNativeAndroid]);

  const budgetPayload = useMemo(
    () => computeBudgetSnapshot(transactions, budgets, currency),
    [transactions, budgets, currency]
  );

  useEffect(() => {
    if (!isNativeAndroid) return;
    const signature = JSON.stringify({ ...budgetPayload, updatedAt: 0 });
    if (budgetSignatureRef.current === signature) return;
    budgetSignatureRef.current = signature;
    void updateBudgetWidget(budgetPayload);
  }, [budgetPayload, isNativeAndroid]);

  const goalPayload = useMemo(
    () => computeGoalSnapshot(goals, currency),
    [goals, currency]
  );

  useEffect(() => {
    if (!isNativeAndroid) return;
    const signature = JSON.stringify({ ...goalPayload, updatedAt: 0 });
    if (goalSignatureRef.current === signature) return;
    goalSignatureRef.current = signature;
    void updateGoalWidget(goalPayload);
  }, [goalPayload, isNativeAndroid]);

  const calendarPayload = useMemo(
    () => computeCalendarSnapshot(transactions),
    [transactions]
  );

  useEffect(() => {
    if (!isNativeAndroid) return;
    const signature = JSON.stringify({ ...calendarPayload, updatedAt: 0 });
    if (calendarSignatureRef.current === signature) return;
    calendarSignatureRef.current = signature;
    void updateCalendarWidget(calendarPayload);
  }, [calendarPayload, isNativeAndroid]);

  const statsPayload = useMemo(
    () => computeStatsSnapshot(transactions, currency),
    [transactions, currency]
  );

  useEffect(() => {
    if (!isNativeAndroid) return;
    const signature = JSON.stringify({ ...statsPayload, updatedAt: 0 });
    if (statsSignatureRef.current === signature) return;
    statsSignatureRef.current = signature;
    void updateStatsWidget(statsPayload);
  }, [statsPayload, isNativeAndroid]);
}
