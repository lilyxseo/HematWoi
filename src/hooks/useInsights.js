import { useMemo } from "react";

const JAKARTA_TIMEZONE = "Asia/Jakarta";

const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: JAKARTA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getJakartaDateParts(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const parts = jakartaDateFormatter.formatToParts(date);
  const lookup = Object.create(null);
  for (const part of parts) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      lookup[part.type] = part.value;
    }
  }

  const year = Number.parseInt(lookup.year ?? "", 10);
  const month = lookup.month;
  const day = Number.parseInt(lookup.day ?? "", 10);

  if (!year || !month || !day) return null;

  return { year, month, day };
}

function getJakartaMonthKey(input) {
  const parts = getJakartaDateParts(input);
  if (!parts) return null;
  return `${parts.year}-${parts.month}`;
}

function getCurrentJakartaMonthIndex(baseDate = new Date()) {
  const parts = getJakartaDateParts(baseDate);
  if (!parts) return null;
  return parts.year * 12 + (Number.parseInt(parts.month, 10) - 1);
}

export function aggregateInsights(txs = [], baseDate = new Date()) {
  const currentMonthIndex = getCurrentJakartaMonthIndex(baseDate);
  if (currentMonthIndex == null) {
    return { kpis: { income: 0, expense: 0, net: 0, avgDaily: 0 }, trend: [], categories: [], topSpends: [] };
  }

  const currentMonthKey = getJakartaMonthKey(baseDate);

  const monthTx = txs.filter((t) => getJakartaMonthKey(t.date) === currentMonthKey);
  const income = monthTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = monthTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const net = income - expense;
  const todayParts = getJakartaDateParts(baseDate);
  const day = todayParts?.day ?? 0;
  const avgDaily = day ? expense / day : 0;

  // trend last 6 months (including current)
  const trendMap = new Map();
  const oldestMonthIndex = currentMonthIndex - 5;

  for (const t of txs) {
    const parts = getJakartaDateParts(t.date);
    if (!parts) continue;
    if (t.type !== "income" && t.type !== "expense") continue;
    const monthIndex = parts.year * 12 + (Number.parseInt(parts.month, 10) - 1);
    if (monthIndex < oldestMonthIndex || monthIndex > currentMonthIndex) continue;

    const key = `${parts.year}-${parts.month}`;
    const existing = trendMap.get(key) ?? { month: key, income: 0, expense: 0 };
    existing[t.type] += Number(t.amount || 0);
    trendMap.set(key, existing);
  }

  const trend = Array.from({ length: 6 }).map((_, i) => {
    const monthIndex = oldestMonthIndex + i;
    const year = Math.floor(monthIndex / 12);
    const month = String((monthIndex % 12) + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    const entry = trendMap.get(key) || { income: 0, expense: 0 };
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

export default function useInsights(txs = []) {
  const key = txs.map((t) => `${t.id || t.date}-${t.amount}-${t.type}`).join("|");
  return useMemo(() => {
    if (cache.has(key)) return cache.get(key);
    const data = aggregateInsights(txs);
    cache.set(key, data);
    return data;
  }, [key, txs]);
}

