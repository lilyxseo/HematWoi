import { registerPlugin } from '@capacitor/core';
import { isAndroid, isNativePlatform } from '../native';

export type WidgetType = 'summary' | 'budget' | 'goal' | 'calendar' | 'stats';

export type WidgetSummaryPayload = {
  dateISO: string;
  currency: string;
  incomeToday: number;
  expenseToday: number;
  netToday: number;
  countTxToday: number;
  updatedAt?: number;
};

export type WidgetBudgetPayload = {
  month: string;
  currency: string;
  totalBudget: number;
  expenseToDate: number;
  updatedAt?: number;
};

export type WidgetGoalPayload = {
  name: string;
  currency: string;
  targetAmount: number;
  savedAmount: number;
  updatedAt?: number;
};

export type WidgetCalendarHighlight = {
  date: string;
  intensity: number;
};

export type WidgetCalendarPayload = {
  month: string;
  highlights: WidgetCalendarHighlight[];
  updatedAt?: number;
};

export type WidgetStatsDailyEntry = {
  date: string;
  expense: number;
};

export type WidgetStatsPayload = {
  month: string;
  currency: string;
  income: number;
  expense: number;
  daily: WidgetStatsDailyEntry[];
  updatedAt?: number;
};

type WidgetBridgePlugin = {
  setWidgetData(options: { type: WidgetType; payload: Record<string, any> }): Promise<void>;
  refreshAll(): Promise<void>;
};

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge', {
  web: () => ({
    async setWidgetData() {
      return undefined;
    },
    async refreshAll() {
      return undefined;
    },
  }),
});

export async function updateSummaryWidget(payload: WidgetSummaryPayload): Promise<void> {
  await sendWidgetData('summary', normalizeSummaryPayload(payload));
}

export async function updateBudgetWidget(payload: WidgetBudgetPayload): Promise<void> {
  await sendWidgetData('budget', normalizeBudgetPayload(payload));
}

export async function updateGoalWidget(payload: WidgetGoalPayload): Promise<void> {
  await sendWidgetData('goal', normalizeGoalPayload(payload));
}

export async function updateCalendarWidget(payload: WidgetCalendarPayload): Promise<void> {
  await sendWidgetData('calendar', normalizeCalendarPayload(payload));
}

export async function updateStatsWidget(payload: WidgetStatsPayload): Promise<void> {
  await sendWidgetData('stats', normalizeStatsPayload(payload));
}

export async function refreshAllWidgets(): Promise<void> {
  if (!isNativePlatform() || !isAndroid()) return;
  try {
    await WidgetBridge.refreshAll();
  } catch (error) {
    console.warn('[widget] Failed to refresh widgets', error);
  }
}

async function sendWidgetData(type: WidgetType, payload: Record<string, any>): Promise<void> {
  if (!isNativePlatform() || !isAndroid()) return;
  try {
    await WidgetBridge.setWidgetData({ type, payload });
  } catch (error) {
    console.warn(`[widget] Failed to update ${type} widget`, error);
  }
}

function normalizeSummaryPayload(payload: WidgetSummaryPayload): WidgetSummaryPayload {
  const updatedAt = payload.updatedAt ?? Date.now();
  return {
    dateISO: payload.dateISO,
    currency: payload.currency || 'IDR',
    incomeToday: Math.max(0, Math.round(payload.incomeToday || 0)),
    expenseToday: Math.max(0, Math.round(payload.expenseToday || 0)),
    netToday: Math.round(payload.netToday || 0),
    countTxToday: Math.max(0, Math.round(payload.countTxToday || 0)),
    updatedAt,
  };
}

function normalizeBudgetPayload(payload: WidgetBudgetPayload): WidgetBudgetPayload {
  const updatedAt = payload.updatedAt ?? Date.now();
  return {
    month: sanitizeMonth(payload.month),
    currency: payload.currency || 'IDR',
    totalBudget: Math.max(0, Math.round(payload.totalBudget || 0)),
    expenseToDate: Math.max(0, Math.round(payload.expenseToDate || 0)),
    updatedAt,
  };
}

function normalizeGoalPayload(payload: WidgetGoalPayload): WidgetGoalPayload {
  const updatedAt = payload.updatedAt ?? Date.now();
  return {
    name: (payload.name || '').trim() || '—',
    currency: payload.currency || 'IDR',
    targetAmount: Math.max(0, Math.round(payload.targetAmount || 0)),
    savedAmount: Math.max(0, Math.round(payload.savedAmount || 0)),
    updatedAt,
  };
}

function normalizeCalendarPayload(payload: WidgetCalendarPayload): WidgetCalendarPayload {
  const updatedAt = payload.updatedAt ?? Date.now();
    const highlights = Array.isArray(payload.highlights)
      ? payload.highlights
          .map((item) => ({
            date: sanitizeDate(item?.date),
            intensity: clamp(Math.round(item?.intensity ?? 0), 0, 3),
          }))
        .filter((item) => Boolean(item.date))
    : [];
  return {
    month: sanitizeMonth(payload.month),
    highlights,
    updatedAt,
  };
}

function normalizeStatsPayload(payload: WidgetStatsPayload): WidgetStatsPayload {
  const updatedAt = payload.updatedAt ?? Date.now();
  const daily = Array.isArray(payload.daily)
    ? payload.daily.map((item) => ({
        date: sanitizeDate(item?.date),
        expense: Math.max(0, Math.round(item?.expense || 0)),
      }))
    : [];
  return {
    month: sanitizeMonth(payload.month),
    currency: payload.currency || 'IDR',
    income: Math.max(0, Math.round(payload.income || 0)),
    expense: Math.max(0, Math.round(payload.expense || 0)),
    daily,
    updatedAt,
  };
}

function sanitizeDate(input?: string): string {
  if (!input) {
    return new Date().toISOString().slice(0, 10);
  }
  return input.slice(0, 10);
}

function sanitizeMonth(input?: string): string {
  if (!input) {
    return new Date().toISOString().slice(0, 7);
  }
  return input.slice(0, 7);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
