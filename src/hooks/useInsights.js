import { useEffect, useMemo } from "react";
import { isTransactionDeleted } from "../lib/transactionUtils";

const JAKARTA_TIMEZONE = "Asia/Jakarta";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function getJakartaDateKey(input) {
  const parts = getJakartaDateParts(input);
  if (!parts) return null;
  return `${parts.year}-${parts.month}-${String(parts.day).padStart(2, "0")}`;
}

function toUtcDate(dateValue) {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function countDays(range) {
  if (!range?.start || !range?.end) return null;
  const start = toUtcDate(range.start);
  const end = toUtcDate(range.end);
  if (!start || !end) return null;
  const diff = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
  return diff >= 0 ? diff + 1 : null;
}

function isWithinRange(input, range) {
  if (!range?.start || !range?.end) return false;
  const key = getJakartaDateKey(input);
  if (!key) return false;
  return key >= range.start && key <= range.end;
}

function getCurrentJakartaMonthIndex(baseDate = new Date()) {
  const parts = getJakartaDateParts(baseDate);
  if (!parts) return null;
  return parts.year * 12 + (Number.parseInt(parts.month, 10) - 1);
}

export function aggregateInsights(txs = [], options = {}) {
  const { baseDate, range } = options ?? {};
  const resolvedBaseDate =
    baseDate ?? (range?.end ? new Date(`${range.end}T00:00:00+07:00`) : new Date());
  const activeTxs = Array.isArray(txs)
    ? txs.filter((tx) => !isTransactionDeleted(tx))
    : [];
  const currentMonthIndex = getCurrentJakartaMonthIndex(resolvedBaseDate);
  if (currentMonthIndex == null) {
    return { kpis: { income: 0, expense: 0, net: 0, avgDaily: 0 }, trend: [], categories: [], topSpends: [] };
  }

  const currentMonthKey = getJakartaMonthKey(resolvedBaseDate);
  const periodTx = range?.start && range?.end
    ? activeTxs.filter((t) => isWithinRange(t.date, range))
    : activeTxs.filter((t) => getJakartaMonthKey(t.date) === currentMonthKey);
  const income = periodTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = periodTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const net = income - expense;
  const dayCount = countDays(range);
  const todayParts = getJakartaDateParts(resolvedBaseDate);
  const day = dayCount ?? todayParts?.day ?? 0;
  const avgDaily = day ? expense / day : 0;

  // trend last 6 months (including current)
  const trendMap = new Map();
  const oldestMonthIndex = currentMonthIndex - 5;

  for (const t of activeTxs) {
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

  // category breakdown for current period
  const categories = periodTx
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

  // top spends for current period
  const topSpends = periodTx
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

export default function useInsights(txs = [], options = {}) {
  const { range } = options ?? {};
  const sanitizedTxs = useMemo(
    () => (Array.isArray(txs) ? txs.filter((tx) => !isTransactionDeleted(tx)) : []),
    [txs],
  );
  useEffect(() => {
    if (typeof import.meta === "undefined" || !import.meta.env?.DEV) return;
    console.debug("[distribusi-kategori:source]", {
      queryKey: null,
      txCount: sanitizedTxs.length,
    });
  }, [sanitizedTxs.length]);
  const rangeKey = range?.start && range?.end ? `${range.start}:${range.end}` : "current";
  const key = `${rangeKey}|${sanitizedTxs.map((t) => `${t.id || t.date}-${t.amount}-${t.type}`).join("|")}`;
  return useMemo(() => {
    if (cache.has(key)) return cache.get(key);
    const data = aggregateInsights(sanitizedTxs, { range });
    cache.set(key, data);
    return data;
  }, [key, range, sanitizedTxs]);
}
