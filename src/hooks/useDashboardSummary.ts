import { useMemo } from 'react';

export interface SummaryTransaction {
  id?: string | number;
  date: string | Date;
  type?: string;
  amount?: number | string | null;
  category?: string | null;
}

export interface MonthlyTrendPoint {
  month: string;
  net: number;
}

export interface CategoryBreakdownItem {
  name: string;
  value: number;
}

export interface DashboardSummary {
  kpis: {
    income: number;
    expense: number;
    net: number;
    avgDaily: number;
  };
  trend: MonthlyTrendPoint[];
  categories: CategoryBreakdownItem[];
  topSpends: SummaryTransaction[];
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function aggregateDashboardSummary(
  txs: SummaryTransaction[] = [],
): DashboardSummary {
  const today = new Date();
  const monthStr = today.toISOString().slice(0, 7);

  const monthTx = txs.filter((t) => String(t.date).slice(0, 7) === monthStr);
  const income = monthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + toNumber(t.amount), 0);
  const expense = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + toNumber(t.amount), 0);
  const net = income - expense;
  const day = today.getDate();
  const avgDaily = day ? expense / day : 0;

  const trendMap: Record<string, { month: string; income: number; expense: number }> = {};
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  for (const tx of txs) {
    const date = new Date(tx.date);
    if (Number.isNaN(date.getTime())) continue;
    if (date < start || date > today) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!trendMap[key]) trendMap[key] = { month: key, income: 0, expense: 0 };
    const amount = toNumber(tx.amount);
    if (tx.type === 'income') {
      trendMap[key].income += amount;
    } else if (tx.type === 'expense') {
      trendMap[key].expense += amount;
    }
  }

  const trend: MonthlyTrendPoint[] = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const entry = trendMap[key] || { month: key, income: 0, expense: 0 };
    return { month: key, net: entry.income - entry.expense };
  });

  const catMap: Record<string, number> = {};
  for (const tx of monthTx) {
    if (tx.type !== 'expense') continue;
    const key = tx.category || 'Lainnya';
    catMap[key] = (catMap[key] || 0) + toNumber(tx.amount);
  }
  const categories: CategoryBreakdownItem[] = Object.entries(catMap).map(([name, value]) => ({
    name,
    value,
  }));

  const topSpends = monthTx
    .filter((tx) => tx.type === 'expense')
    .slice()
    .sort((a, b) => toNumber(b.amount) - toNumber(a.amount))
    .slice(0, 10);

  return {
    kpis: { income, expense, net, avgDaily },
    trend,
    categories,
    topSpends,
  };
}

const cache = new Map<string, DashboardSummary>();

export default function useDashboardSummary(txs: SummaryTransaction[] = []): DashboardSummary {
  const key = txs
    .map((t) => `${t.id ?? t.date}-${toNumber(t.amount)}-${t.type ?? ''}`)
    .join('|');
  return useMemo(() => {
    if (cache.has(key)) return cache.get(key)!;
    const data = aggregateDashboardSummary(txs);
    cache.set(key, data);
    return data;
  }, [key, txs]);
}
