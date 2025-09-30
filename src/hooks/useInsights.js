import { useMemo } from "react";

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function normalizeMonth(value) {
  if (typeof value !== "string") return null;
  const match = value.match(MONTH_PATTERN);
  if (!match) return null;
  const monthIndex = Number(match[2]);
  if (Number.isNaN(monthIndex) || monthIndex < 1 || monthIndex > 12) return null;
  return `${match[1]}-${match[2]}`;
}

export function aggregateInsights(txs = [], month) {
  const normalizedMonth = normalizeMonth(month);
  const today = new Date();
  const referenceMonth = normalizedMonth ?? today.toISOString().slice(0, 7);

  const [yearStr, monthStr] = referenceMonth.split("-");
  const year = Number(yearStr);
  const monthZeroBased = Number(monthStr) - 1;
  const monthStart = new Date(year, monthZeroBased, 1);
  const nextMonthStart = new Date(year, monthZeroBased + 1, 1);

  const monthTx = txs.filter((t) => {
    const date = new Date(t.date);
    if (Number.isNaN(date.getTime())) return false;
    return date >= monthStart && date < nextMonthStart;
  });
  const income = monthTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = monthTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const net = income - expense;
  const isCurrentMonth = today >= monthStart && today < nextMonthStart;
  const totalDaysInMonth = Math.round(
    (nextMonthStart.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const elapsedDays = isCurrentMonth ? today.getDate() : totalDaysInMonth;
  const avgDaily = elapsedDays ? expense / elapsedDays : 0;

  // trend last 6 months (including current)
  const trendMap = {};
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  for (const t of txs) {
    const d = new Date(t.date);
    if (d < start || d > today) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!trendMap[key]) trendMap[key] = { month: key, income: 0, expense: 0 };
    trendMap[key][t.type] += Number(t.amount || 0);
  }
  const trend = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = trendMap[key] || { month: key, income: 0, expense: 0 };
    return { month: key, net: entry.income - entry.expense };
  });

  // category breakdown for current month
  const categories = monthTx
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => {
      const key = t.category || "Lainnya";
      const amount = Number(t.amount || 0);
      if (!amount) return acc;

      const entry = acc.get(key) ?? { name: key, value: 0, color: undefined };
      entry.value += amount;
      if (!entry.color && typeof t.category_color === "string" && t.category_color) {
        entry.color = t.category_color;
      }
      acc.set(key, entry);
      return acc;
    }, new Map())
    .values();

  const categoriesArray = Array.from(categories, (item) => ({
    name: item.name,
    value: item.value,
    color: item.color,
  }));

  // top spends for current month
  const topSpends = monthTx
    .filter((t) => t.type === "expense")
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));

  return {
    kpis: { income, expense, net, avgDaily },
    trend,
    categories: categoriesArray,
    topSpends,
  };
}

const cache = new Map();

export default function useInsights(txs = [], month) {
  const normalizedMonth = normalizeMonth(month) ?? null;
  const key = [
    normalizedMonth ?? "current",
    ...txs.map((t) => `${t.id || t.date}-${t.amount}-${t.type}`),
  ].join("|");

  return useMemo(() => {
    if (cache.has(key)) return cache.get(key);
    const data = aggregateInsights(txs, normalizedMonth ?? undefined);
    cache.set(key, data);
    return data;
  }, [key, txs, normalizedMonth]);
}

