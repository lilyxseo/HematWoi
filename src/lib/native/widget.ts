import { registerPlugin } from '@capacitor/core';
import { isAndroid, isNativePlatform } from '../native';

export type WidgetSummaryPayload = {
  dateISO: string;
  currency: string;
  incomeToday: number;
  expenseToday: number;
  netToday: number;
  countTxToday: number;
  updatedAt?: number;
};

type WidgetBridgePlugin = {
  setWidgetData(options: WidgetSummaryPayload): Promise<void>;
  refresh(): Promise<void>;
  openRoute(options: { route: string }): Promise<void>;
};

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge', {
  web: () => ({
    async setWidgetData() {
      return undefined;
    },
    async refresh() {
      return undefined;
    },
    async openRoute() {
      return undefined;
    },
  }),
});

export async function updateTodayWidget(payload: WidgetSummaryPayload): Promise<void> {
  if (!isNativePlatform() || !isAndroid()) return;
  try {
    const normalized = normalizePayload(payload);
    await WidgetBridge.setWidgetData(normalized);
  } catch (error) {
    console.warn('[widget] Failed to update widget', error);
  }
}

export async function refreshTodayWidget(): Promise<void> {
  if (!isNativePlatform() || !isAndroid()) return;
  try {
    await WidgetBridge.refresh();
  } catch (error) {
    console.warn('[widget] Failed to refresh widget', error);
  }
}

export async function openWidgetRoute(route: string): Promise<void> {
  if (!isNativePlatform() || !isAndroid()) return;
  try {
    await WidgetBridge.openRoute({ route });
  } catch (error) {
    console.warn('[widget] Failed to open widget route', error);
  }
}

function normalizePayload(payload: WidgetSummaryPayload): WidgetSummaryPayload {
  const updatedAt = payload.updatedAt ?? Date.now();
  return {
    dateISO: payload.dateISO,
    currency: payload.currency || 'IDR',
    incomeToday: Math.max(0, Math.round(payload.incomeToday || 0)),
    expenseToday: Math.max(0, Math.round(payload.expenseToday || 0)),
    netToday: Math.round(payload.netToday),
    countTxToday: Math.max(0, Math.round(payload.countTxToday || 0)),
    updatedAt,
  };
}
