import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../lib/format";

type TransactionLike = {
  id?: string | number;
  date?: string | null;
  created_at?: string | null;
  amount?: number | string | null;
  type?: string | null;
  transaction_type?: string | null;
  deleted_at?: string | null;
  category?: string | null;
  category_name?: string | null;
  categories?: { name?: string | null } | null;
  merchant?: string | null;
  merchant_name?: string | null;
  merchants?: { name?: string | null } | null;
};

export type DailyDigestMode = "modal" | "banner";

export interface DailyDigestTopItem {
  name: string;
  amount: number;
}

export interface DailyDigestData {
  date: string;
  dateLabel: string;
  totalSpent: number;
  transactionCount: number;
  average7Day: number;
  differencePercent: number;
  differenceLabel: string;
  differenceDirection: "up" | "down" | "flat";
  message: string;
  topCategories: DailyDigestTopItem[];
  topMerchants: DailyDigestTopItem[];
}

interface UseDailyDigestOptions {
  transactions?: TransactionLike[] | null;
  userId?: string | null;
  ready: boolean;
}

interface UseDailyDigestResult {
  open: boolean;
  mode: DailyDigestMode;
  data: DailyDigestData | null;
  acknowledge: () => void;
  dismiss: () => void;
  reopen: () => void;
}

const TIMEZONE = "Asia/Jakarta";
const DAY_IN_MS = 86400000;

const isoFormatterCache = new Map<string, Intl.DateTimeFormat>();
const labelFormatterCache = new Map<string, Intl.DateTimeFormat>();
const numberFormatter = new Intl.NumberFormat("id-ID");

function getIsoFormatter(timeZone: string) {
  if (!isoFormatterCache.has(timeZone)) {
    isoFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    );
  }
  return isoFormatterCache.get(timeZone)!;
}

function getLabelFormatter(timeZone: string) {
  if (!labelFormatterCache.has(timeZone)) {
    labelFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("id-ID", {
        timeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );
  }
  return labelFormatterCache.get(timeZone)!;
}

function resolveLocalDate(
  input: TransactionLike,
  formatter: Intl.DateTimeFormat
): string | null {
  const raw = input?.date ?? input?.created_at;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatter.format(parsed);
}

function resolveCategory(tx: TransactionLike): string | null {
  return (
    tx?.category ??
    tx?.category_name ??
    tx?.categories?.name ??
    null
  );
}

function resolveMerchant(tx: TransactionLike): string | null {
  return tx?.merchant ?? tx?.merchant_name ?? tx?.merchants?.name ?? null;
}

function toAmount(value: TransactionLike["amount"]): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed);
}

function buildMessage(
  totalSpent: number,
  transactionCount: number,
  average7Day: number,
  differencePercent: number,
  focusName: string | null
) {
  const parts: string[] = [];
  const formattedTotal = formatCurrency(totalSpent);
  const countText = numberFormatter.format(transactionCount);

  if (transactionCount > 0) {
    parts.push(`Kemarin kamu belanja ${formattedTotal} di ${countText} transaksi.`);
  } else {
    parts.push("Kemarin kamu tidak ada pengeluaran.");
  }

  if (average7Day > 0 && transactionCount > 0) {
    const rounded = Math.round(differencePercent);
    const sign = rounded > 0 ? "+" : rounded < 0 ? "" : "";
    if (rounded === 0) {
      parts.push("Itu setara dengan rata-rata 7 hari.");
    } else {
      parts.push(`Itu ${sign}${rounded}% dari rata-rata 7 hari.`);
    }
  } else if (average7Day > 0) {
    parts.push("Rata-rata 7 harimu tetap aman.");
  } else if (transactionCount > 0) {
    parts.push("Belum ada rata-rata 7 hari untuk dibandingkan.");
  }

  if (transactionCount > 0) {
    const focus = focusName?.trim();
    const label = focus && focus !== "Tanpa kategori" && focus !== "Tanpa merchant"
      ? focus
      : "pengeluaran harianmu";
    parts.push(`Coba hemat di ${label} ya 😉`);
  } else {
    parts.push("Tetap pertahankan kebiasaan baik ini ya 😉");
  }

  return parts.join(" ");
}

function computeTop(
  expenses: TransactionLike[],
  resolver: (tx: TransactionLike) => string | null,
  limit: number,
  fallbackLabel: string
): DailyDigestTopItem[] {
  const map = new Map<string, number>();
  expenses.forEach((tx) => {
    const name = resolver(tx)?.trim();
    const label = name && name.length ? name : fallbackLabel;
    const prev = map.get(label) ?? 0;
    map.set(label, prev + toAmount(tx.amount));
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, amount]) => ({ name, amount }));
}

function computeDigest(
  transactions: TransactionLike[] | null | undefined,
  timeZone: string
): DailyDigestData {
  const isoFormatter = getIsoFormatter(timeZone);
  const labelFormatter = getLabelFormatter(timeZone);
  const now = new Date();
  const yesterdayDate = new Date(now.getTime() - DAY_IN_MS);
  const yesterday = isoFormatter.format(yesterdayDate);
  const dateLabel = labelFormatter.format(yesterdayDate);

  const lastSevenDates = Array.from({ length: 7 }, (_, idx) =>
    isoFormatter.format(new Date(now.getTime() - DAY_IN_MS * (idx + 1)))
  );

  const list = Array.isArray(transactions) ? transactions : [];
  const totalsByDate = new Map<string, { total: number; count: number }>();
  const yesterdayExpenses: TransactionLike[] = [];

  list.forEach((tx) => {
    if (!tx || tx.deleted_at) return;
    const type = String(tx.type ?? tx.transaction_type ?? "").toLowerCase();
    if (type !== "expense") return;
    const localDate = resolveLocalDate(tx, isoFormatter);
    if (!localDate) return;
    const amount = toAmount(tx.amount);
    if (localDate === yesterday) {
      yesterdayExpenses.push(tx);
    }
    const stats = totalsByDate.get(localDate);
    if (stats) {
      stats.total += amount;
      stats.count += 1;
    } else {
      totalsByDate.set(localDate, { total: amount, count: 1 });
    }
  });

  const yesterdayStats = totalsByDate.get(yesterday) ?? { total: 0, count: 0 };
  const totalSpent = yesterdayStats.total ?? 0;
  const transactionCount = yesterdayExpenses.length;

  const sevenDayTotal = lastSevenDates.reduce(
    (sum, date) => sum + (totalsByDate.get(date)?.total ?? 0),
    0
  );
  const average7Day = sevenDayTotal / lastSevenDates.length;

  const differencePercent = average7Day > 0
    ? ((totalSpent - average7Day) / average7Day) * 100
    : 0;
  const roundedDiff = Number.isFinite(differencePercent)
    ? Math.round(differencePercent)
    : 0;
  const differenceLabel =
    roundedDiff > 0
      ? `+${roundedDiff}%`
      : roundedDiff < 0
      ? `${roundedDiff}%`
      : "0%";
  const differenceDirection =
    roundedDiff > 0 ? "up" : roundedDiff < 0 ? "down" : "flat";

  const topCategories = computeTop(
    yesterdayExpenses,
    resolveCategory,
    2,
    "Tanpa kategori"
  );
  const topMerchants = computeTop(
    yesterdayExpenses,
    resolveMerchant,
    2,
    "Tanpa merchant"
  );

  const focusCandidate =
    topCategories.find((item) => item.name && item.name !== "Tanpa kategori")?.name ??
    topMerchants.find((item) => item.name && item.name !== "Tanpa merchant")?.name ??
    null;

  const message = buildMessage(
    totalSpent,
    transactionCount,
    average7Day,
    differencePercent,
    focusCandidate
  );

  return {
    date: yesterday,
    dateLabel,
    totalSpent,
    transactionCount,
    average7Day,
    differencePercent,
    differenceLabel,
    differenceDirection,
    message,
    topCategories,
    topMerchants,
  };
}

export default function useDailyDigest({
  transactions,
  userId,
  ready,
}: UseDailyDigestOptions): UseDailyDigestResult {
  const timeZone = TIMEZONE;
  const today = getIsoFormatter(timeZone).format(new Date());
  const digestData = useMemo(
    () => computeDigest(transactions, timeZone),
    [transactions, timeZone]
  );

  const storageKey = `hw:digest:last:${userId ?? "anon"}`;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DailyDigestMode>("modal");

  useEffect(() => {
    if (!ready) return;
    let lastShown: string | null = null;
    try {
      lastShown = localStorage.getItem(storageKey);
    } catch {
      lastShown = null;
    }
    if (lastShown === today) {
      setOpen(false);
      setMode("modal");
      return;
    }
    if (!digestData) return;
    setOpen((prev) => {
      if (!prev) {
        setMode("modal");
      }
      return true;
    });
  }, [ready, storageKey, today, digestData]);

  const acknowledge = useCallback(() => {
    try {
      localStorage.setItem(storageKey, today);
    } catch {
      /* ignore */
    }
    setOpen(false);
    setMode("modal");
  }, [storageKey, today]);

  const dismiss = useCallback(() => {
    setMode("banner");
    setOpen(true);
  }, []);

  const reopen = useCallback(() => {
    if (!open) {
      setOpen(true);
    }
    setMode("modal");
  }, [open]);

  return {
    open,
    mode,
    data: digestData,
    acknowledge,
    dismiss,
    reopen,
  };
}
