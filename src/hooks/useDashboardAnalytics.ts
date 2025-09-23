import { useMemo } from "react";

export interface TransactionRecord {
  id?: string | number;
  date: string | Date;
  type: string;
  amount?: number | string;
  category?: string | null;
}

export interface AggregateResult {
  kpis: {
    income: number;
    expense: number;
    net: number;
    avgDaily: number;
  };
  trend: { month: string; net: number }[];
  categories: { name: string; value: number }[];
  topSpends: TransactionRecord[];
}

export function aggregateDashboardAnalytics(txs: TransactionRecord[] = []): AggregateResult {
  const today = new Date();
  const monthStr = today.toISOString().slice(0, 7);

  const monthTx = txs.filter((t) => String(t.date).slice(0, 7) === monthStr);
  const income = monthTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const expense = monthTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const net = income - expense;
  const day = today.getDate();
  const avgDaily = day ? expense / day : 0;

  const trendMap: Record<string, { month: string; income: number; expense: number }> = {};
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  for (const t of txs) {
    const d = new Date(t.date);
    if (d < start || d > today) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!trendMap[key]) trendMap[key] = { month: key, income: 0, expense: 0 };
    if (t.type === "income") {
      trendMap[key].income += Number(t.amount ?? 0);
    } else if (t.type === "expense") {
      trendMap[key].expense += Number(t.amount ?? 0);
    }
  }

  const trend = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = trendMap[key] ?? { month: key, income: 0, expense: 0 };
    return { month: key, net: entry.income - entry.expense };
  });

  const catMap = monthTx
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      const key = t.category || "Lainnya";
      acc[key] = (acc[key] ?? 0) + Number(t.amount ?? 0);
      return acc;
    }, {});
  const categories = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  const topSpends = monthTx
    .filter((t) => t.type === "expense")
    .sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))
    .slice(0, 10);

  return {
    kpis: { income, expense, net, avgDaily },
    trend,
    categories,
    topSpends,
  };
}

const cache = new Map<string, AggregateResult>();

export default function useDashboardAnalytics(txs: TransactionRecord[] = []): AggregateResult {
  const key = txs.map((t) => `${t.id ?? t.date}-${t.amount}-${t.type}`).join("|");
  return useMemo(() => {
    if (cache.has(key)) return cache.get(key)!;
    const data = aggregateDashboardAnalytics(txs);
    cache.set(key, data);
    return data;
  }, [key, txs]);
}
