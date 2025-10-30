import { useEffect, useRef } from 'react';
import type { WidgetSummaryPayload } from '../lib/native/widget';
import { updateTodayWidget } from '../lib/native/widget';
import { isAndroid, isNativePlatform } from '../lib/native';

const jakartaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
});

type TransactionLike = {
  id?: string;
  type?: string;
  date?: string | Date | null;
  amount?: number | string | null;
};

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

function computeTodaySummary(
  transactions: TransactionLike[],
  currency: string | undefined
): WidgetSummaryPayload {
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

export function useWidgetAutoSync(
  transactions: TransactionLike[] | undefined,
  currency: string | undefined
): void {
  const lastSignatureRef = useRef<string>('');
  useEffect(() => {
    if (!isNativePlatform() || !isAndroid()) return;
    if (!transactions || transactions.length === 0) {
      const fallback = computeTodaySummary([], currency);
      const signature = JSON.stringify({ ...fallback, updatedAt: 0 });
      if (lastSignatureRef.current !== signature) {
        lastSignatureRef.current = signature;
        void updateTodayWidget(fallback);
      }
      return;
    }
    const handle = window.setTimeout(() => {
      const summary = computeTodaySummary(transactions, currency);
      const signature = JSON.stringify({ ...summary, updatedAt: 0 });
      if (lastSignatureRef.current === signature) {
        return;
      }
      lastSignatureRef.current = signature;
      void updateTodayWidget(summary);
    }, 500);

    return () => {
      window.clearTimeout(handle);
    };
  }, [transactions, currency]);
}
