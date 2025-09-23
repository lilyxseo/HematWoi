import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const TIMEZONE = "Asia/Jakarta";
const STORAGE_PREFIX = "hw:digest:last:";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const HUMAN_DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const CURRENCY_FORMATTER = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

export interface DigestTransaction {
  amount?: number | string | null;
  type?: string | null;
  date?: string | null;
  category?: string | null;
  category_name?: string | null;
  merchant?: string | null | { name?: string | null };
  merchant_name?: string | null;
  deleted_at?: string | null;
}

interface HighlightItem {
  name: string;
  amount: number;
}

export interface DailyDigestData {
  totalSpent: number;
  transactionCount: number;
  average7Day: number;
  diffPercent: number;
  diffDirection: "up" | "down" | "flat";
  topCategories: HighlightItem[];
  topMerchants: HighlightItem[];
  highlightLabel: string | null;
  suggestion: string;
  summary: string;
  comparisonSentence: string;
  yesterdayLabel: string;
  yesterdayDate: string;
}

export interface UseDailyDigestOptions {
  transactions?: DigestTransaction[] | null;
}

export interface UseDailyDigestResult {
  open: boolean;
  data: DailyDigestData | null;
  close: () => void;
  markSeen: () => void;
  variant: "modal" | "banner";
  uid: string | null;
}

function formatDateInZone(date: Date): string {
  return DATE_FORMATTER.format(date);
}

function shiftLocalDateString(base: string, offset: number): string {
  const [year, month, day] = base.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return base;
  const ref = new Date(Date.UTC(year, month - 1, day));
  ref.setUTCDate(ref.getUTCDate() + offset);
  const y = ref.getUTCFullYear();
  const m = String(ref.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ref.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTransactionDate(tx: DigestTransaction): string | null {
  if (!tx?.date) return null;
  const parsed = new Date(tx.date);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateInZone(parsed);
}

function toNumber(value: number | string | null | undefined): number {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getMerchantName(tx: DigestTransaction): string | null {
  const candidates: Array<string | null | undefined> = [
    tx.merchant_name,
    typeof tx.merchant === "string" ? tx.merchant : null,
    tx.merchant && typeof tx.merchant === "object" ? tx.merchant.name : null,
  ];
  for (const candidate of candidates) {
    const trimmed = typeof candidate === "string" ? candidate.trim() : "";
    if (trimmed) return trimmed;
  }
  return null;
}

function getCategoryName(tx: DigestTransaction): string | null {
  const candidates: Array<string | null | undefined> = [
    tx.category,
    tx.category_name,
  ];
  for (const candidate of candidates) {
    const trimmed = typeof candidate === "string" ? candidate.trim() : "";
    if (trimmed) return trimmed;
  }
  return null;
}

function summarizeHighlights(entries: HighlightItem[]): string | null {
  if (!entries.length) return null;
  if (entries.length === 1) return entries[0].name;
  return `${entries[0].name} & ${entries[1].name}`;
}

function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(Math.round(value));
}

function buildSummary(
  totalSpent: number,
  transactionCount: number,
  diffDirection: "up" | "down" | "flat",
  diffPercent: number,
  average7Day: number,
  suggestion: string,
): { comparison: string; summary: string } {
  if (transactionCount === 0) {
    const comparisonSentence = "Catat transaksi untuk mendapatkan insight harian.";
    const summary = `Kemarin belum ada transaksi yang kamu catat. ${comparisonSentence} ${suggestion}`.trim();
    return { comparison: comparisonSentence, summary };
  }

  const spendSentence = `Kemarin kamu belanja ${formatCurrency(totalSpent)} di ${transactionCount} transaksi.`;
  let comparisonSentence: string;
  if (average7Day > 0) {
    if (diffDirection === "flat") {
      comparisonSentence = "Itu setara dengan rata-rata 7 hari.";
    } else if (diffDirection === "up") {
      comparisonSentence = `Itu lebih tinggi ${Math.abs(Math.round(diffPercent))}% dari rata-rata 7 hari.`;
    } else {
      comparisonSentence = `Itu lebih rendah ${Math.abs(Math.round(diffPercent))}% dari rata-rata 7 hari.`;
    }
  } else {
    comparisonSentence = "Belum ada cukup data untuk rata-rata 7 hari.";
  }
  const summary = `${spendSentence} ${comparisonSentence} ${suggestion}`.trim();
  return { comparison: comparisonSentence, summary };
}

function computeHighlights(map: Map<string, number>): HighlightItem[] {
  return Array.from(map.entries())
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name, amount]) => ({ name, amount }));
}

function computeDigest(
  transactions: DigestTransaction[] | null | undefined,
  todayLocal: string,
): DailyDigestData {
  const yesterdayLocal = shiftLocalDateString(todayLocal, -1);
  const weekStart = shiftLocalDateString(yesterdayLocal, -6);

  const expenses = Array.isArray(transactions)
    ? transactions.filter((tx) => tx && tx.type === "expense" && !tx.deleted_at)
    : [];

  let totalSpent = 0;
  let transactionCount = 0;
  const categoryTotals = new Map<string, number>();
  const merchantTotals = new Map<string, number>();
  let weekTotal = 0;

  for (const tx of expenses) {
    const date = getTransactionDate(tx);
    if (!date) continue;

    const amount = toNumber(tx.amount);
    if (amount <= 0) continue;

    if (date === yesterdayLocal) {
      totalSpent += amount;
      transactionCount += 1;
      const category = getCategoryName(tx);
      if (category) {
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
      }
      const merchant = getMerchantName(tx);
      if (merchant) {
        merchantTotals.set(merchant, (merchantTotals.get(merchant) || 0) + amount);
      }
    }

    if (date >= weekStart && date <= yesterdayLocal) {
      weekTotal += amount;
    }
  }

  const average7Day = weekTotal / 7;
  const diffPercent = average7Day > 0 ? ((totalSpent - average7Day) / average7Day) * 100 : 0;
  const diffDirection: "up" | "down" | "flat" =
    average7Day === 0 || Math.abs(diffPercent) < 0.5
      ? "flat"
      : diffPercent > 0
      ? "up"
      : "down";

  const topCategories = computeHighlights(categoryTotals);
  const topMerchants = computeHighlights(merchantTotals);

  let suggestion = transactionCount === 0
    ? "Mulai catat transaksi agar laporanmu makin lengkap 😉"
    : "Tetap pantau pengeluaran kecil ya 😉";
  const highlightChoices = topCategories.length ? topCategories : topMerchants;
  const highlightLabel = summarizeHighlights(highlightChoices);
  if (highlightLabel) {
    suggestion = diffDirection === "down"
      ? `Mantap! Pertahankan kontrol di ${highlightLabel} ya 😉`
      : `Coba hemat di ${highlightLabel} ya 😉`;
  }

  const { comparison, summary } = buildSummary(
    totalSpent,
    transactionCount,
    diffDirection,
    diffPercent,
    average7Day,
    suggestion,
  );

  const yesterdayDate = yesterdayLocal;
  const yesterdayLabel = HUMAN_DATE_FORMATTER.format(
    new Date(`${yesterdayLocal}T00:00:00+07:00`),
  );

  return {
    totalSpent,
    transactionCount,
    average7Day,
    diffPercent,
    diffDirection,
    topCategories,
    topMerchants,
    highlightLabel,
    suggestion,
    summary,
    comparisonSentence: comparison,
    yesterdayLabel,
    yesterdayDate,
  };
}

interface DigestState {
  open: boolean;
  data: DailyDigestData | null;
  today: string;
}

const DEFAULT_STATE: DigestState = {
  open: false,
  data: null,
  today: "",
};

export function todayJakarta(): string {
  return DATE_FORMATTER.format(new Date());
}

export default function useDailyDigest({
  transactions,
}: UseDailyDigestOptions): UseDailyDigestResult {
  const [{ open, data, today }, setState] = useState<DigestState>(DEFAULT_STATE);
  const [uid, setUid] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const getStorageKey = useCallback((userId: string) => `${STORAGE_PREFIX}${userId}`, []);

  const evaluateDigest = useCallback(
    (userId: string) => {
      if (!userId) return;
      if (typeof window === "undefined") return;

      const todayLocal = todayJakarta();
      const storageKey = getStorageKey(userId);

      let lastShown = "";
      try {
        lastShown = window.localStorage.getItem(storageKey) || "";
      } catch {
        lastShown = "";
      }

      if (lastShown === todayLocal) {
        setState({ open: false, data: null, today: todayLocal });
        return;
      }

      const digest = computeDigest(transactions ?? [], todayLocal);
      setState({ open: true, data: digest, today: todayLocal });
    },
    [getStorageKey, transactions],
  );

  useEffect(() => {
    let active = true;

    async function resolveSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const session = data.session ?? null;
        const nextUid = session?.user?.id ?? null;
        setUid(nextUid);
        setSessionReady(true);
        if (nextUid) {
          evaluateDigest(nextUid);
        } else {
          setState(() => ({ ...DEFAULT_STATE }));
        }
      } catch {
        if (!active) return;
        setUid(null);
        setSessionReady(true);
        setState(() => ({ ...DEFAULT_STATE }));
      }
    }

    resolveSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const nextUid = session?.user?.id ?? null;

      if (event === "SIGNED_OUT") {
        setUid(null);
        setState(() => ({ ...DEFAULT_STATE }));
        setSessionReady(true);
        return;
      }

      if (event === "SIGNED_IN" && nextUid) {
        setUid(nextUid);
        setSessionReady(true);
        evaluateDigest(nextUid);
        return;
      }

      setUid(nextUid);
      setSessionReady(true);
    });

    return () => {
      active = false;
      authListener.subscription?.unsubscribe();
    };
  }, [evaluateDigest]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!uid) return;
    evaluateDigest(uid);
  }, [evaluateDigest, sessionReady, uid]);

  const markSeen = useCallback(() => {
    if (typeof window === "undefined") return;
    const targetDate = today || todayJakarta();
    if (uid) {
      try {
        window.localStorage.setItem(getStorageKey(uid), targetDate);
      } catch {
        /* ignore */
      }
    }
    setState((prev) => ({ ...prev, open: false }));
  }, [getStorageKey, today, uid]);

  const close = useCallback(() => {
    markSeen();
  }, [markSeen]);

  return {
    open,
    data,
    close,
    markSeen,
    variant: "modal",
    uid,
  };
}
