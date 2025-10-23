import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { findUpcoming, loadSubscriptions } from '../lib/subscriptions';

const TIMEZONE = 'Asia/Jakarta';
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const HUMAN_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: TIMEZONE,
  month: 'long',
  year: 'numeric',
});

const DIGEST_TRIGGER_KEY = 'hw:digest:trigger';
const UPCOMING_LOOKAHEAD_DAYS = 7;
const UPCOMING_LIMIT = 4;

export interface DigestTransactionLike {
  amount?: number | string | null;
  type?: string | null;
  date?: string | null;
  category?: string | null;
}

export interface DigestUpcomingItem {
  name: string;
  amount: number;
  days: number;
}

export interface DailyDigestModalData {
  todayKey: string;
  todayLabel: string;
  yesterdayKey: string;
  yesterdayLabel: string;
  monthKey: string;
  monthLabel: string;
  balance: number;
  todayIncome: number;
  todayExpense: number;
  todayNet: number;
  todayCount: number;
  topTodayExpenses: Array<{ name: string; amount: number }>;
  yesterdayExpense: number;
  yesterdayCount: number;
  topYesterdayExpenses: Array<{ name: string; amount: number }>;
  upcoming: DigestUpcomingItem[];
}

export interface UseShowDigestOnLoginOptions {
  transactions?: DigestTransactionLike[] | null;
  balanceHint?: number | null;
}

export interface UseShowDigestOnLoginResult {
  open: boolean;
  data: DailyDigestModalData | null;
  loading: boolean;
  openManual: () => void;
  close: () => void;
}

function getTodayKey(): string {
  return DATE_FORMATTER.format(new Date());
}

function looksLikeDateOnly(value: string): boolean {
  return (
    value.length === 10 &&
    value.charCodeAt(4) === 45 &&
    value.charCodeAt(7) === 45 &&
    value.charCodeAt(0) >= 48 &&
    value.charCodeAt(0) <= 57 &&
    value.charCodeAt(1) >= 48 &&
    value.charCodeAt(1) <= 57 &&
    value.charCodeAt(2) >= 48 &&
    value.charCodeAt(2) <= 57 &&
    value.charCodeAt(3) >= 48 &&
    value.charCodeAt(3) <= 57 &&
    value.charCodeAt(5) >= 48 &&
    value.charCodeAt(5) <= 57 &&
    value.charCodeAt(6) >= 48 &&
    value.charCodeAt(6) <= 57 &&
    value.charCodeAt(8) >= 48 &&
    value.charCodeAt(8) <= 57 &&
    value.charCodeAt(9) >= 48 &&
    value.charCodeAt(9) <= 57
  );
}

function getDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return DATE_FORMATTER.format(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (looksLikeDateOnly(trimmed) && !trimmed.includes('T')) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return DATE_FORMATTER.format(parsed);
  }

  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '.');
    const numeric = Number.parseFloat(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return 0;
}

function loadUpcomingSubscriptions(): DigestUpcomingItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const subscriptions = loadSubscriptions();
    return findUpcoming(subscriptions, UPCOMING_LOOKAHEAD_DAYS)
      .sort((a, b) => a.days - b.days)
      .slice(0, UPCOMING_LIMIT)
      .map(({ sub, days }) => ({
        name: typeof sub?.name === 'string' && sub.name.trim() ? sub.name.trim() : 'Langganan',
        amount: toNumber(sub?.amount),
        days,
      }));
  } catch {
    return [];
  }
}

function buildDigestData(
  transactions: DigestTransactionLike[] | null | undefined,
  balanceHint: number | null | undefined,
  upcoming: DigestUpcomingItem[],
): DailyDigestModalData {
  const todayKey = getTodayKey();
  const monthKey = todayKey.slice(0, 7);
  const todayDate = new Date(`${todayKey}T00:00:00+07:00`);
  const todayLabel = HUMAN_FORMATTER.format(todayDate);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = DATE_FORMATTER.format(yesterdayDate);
  const yesterdayLabel = HUMAN_FORMATTER.format(yesterdayDate);
  const monthLabel = MONTH_LABEL_FORMATTER.format(new Date(`${todayKey}T00:00:00+07:00`));

  let computedBalance = 0;
  let todayIncome = 0;
  let todayExpense = 0;
  let todayCount = 0;
  const todayCategoryTotals = new Map<string, number>();
  let yesterdayExpense = 0;
  let yesterdayCount = 0;
  const yesterdayCategoryTotals = new Map<string, number>();

  const shouldComputeBalance = !(
    typeof balanceHint === 'number' && Number.isFinite(balanceHint)
  );

  const dateCache = new Map<string, string | null>();

  for (const tx of transactions ?? []) {
    const rawDate = tx?.date ?? null;
    let dateKey: string | null = null;

    if (typeof rawDate === 'string') {
      const normalized = rawDate.trim();
      if (dateCache.has(normalized)) {
        dateKey = dateCache.get(normalized) ?? null;
      } else {
        dateKey = getDateKey(normalized);
        dateCache.set(normalized, dateKey);
      }
    } else if (rawDate instanceof Date) {
      dateKey = getDateKey(rawDate);
    } else {
      dateKey = getDateKey(rawDate as string | null | undefined);
    }

    if (!dateKey) continue;

    const isToday = dateKey === todayKey;
    const isYesterday = dateKey === yesterdayKey;

    if (!shouldComputeBalance && !isToday && !isYesterday) {
      continue;
    }

    const type = typeof tx?.type === 'string' ? tx.type.toLowerCase() : '';
    const isIncome = type === 'income';
    const isExpense = type === 'expense';

    const needsAmountForBalance = shouldComputeBalance && (isIncome || isExpense);
    const needsAmountForDay = isToday || isYesterday;

    if (!needsAmountForBalance && !needsAmountForDay) {
      continue;
    }

    const amount = toNumber(tx?.amount);

    if (needsAmountForBalance) {
      if (isIncome) {
        computedBalance += amount;
      } else if (isExpense) {
        computedBalance -= amount;
      }
    }

    if (isIncome && isToday) {
      todayIncome += amount;
    } else if (isExpense && (isToday || isYesterday)) {
      if (isToday) {
        todayExpense += amount;
        if (amount > 0) {
          todayCount += 1;
        }
        const category = typeof tx?.category === 'string' ? tx.category.trim() : '';
        const label = category || 'Tanpa kategori';
        todayCategoryTotals.set(label, (todayCategoryTotals.get(label) || 0) + amount);
      } else {
        yesterdayExpense += amount;
        if (amount > 0) {
          yesterdayCount += 1;
        }
        const category = typeof tx?.category === 'string' ? tx.category.trim() : '';
        const label = category || 'Tanpa kategori';
        yesterdayCategoryTotals.set(label, (yesterdayCategoryTotals.get(label) || 0) + amount);
      }
    }
  }

  const resolvedBalance =
    typeof balanceHint === 'number' && Number.isFinite(balanceHint)
      ? balanceHint
      : computedBalance;

  const topTodayExpenses = Array.from(todayCategoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }));

  const topYesterdayExpenses = Array.from(yesterdayCategoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }));

  const todayNet = todayIncome - todayExpense;

  return {
    todayKey,
    todayLabel,
    yesterdayKey,
    yesterdayLabel,
    monthKey,
    monthLabel,
    balance: resolvedBalance,
    todayIncome,
    todayExpense,
    todayNet,
    todayCount,
    topTodayExpenses,
    yesterdayExpense,
    yesterdayCount,
    topYesterdayExpenses,
    upcoming,
  };
}

function mergeUpcoming(
  subscriptions: DigestUpcomingItem[],
  debts: DigestUpcomingItem[],
): DigestUpcomingItem[] {
  return [...subscriptions, ...debts]
    .sort((a, b) => a.days - b.days)
    .slice(0, UPCOMING_LIMIT);
}

function computeDaysUntil(date: Date): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = target.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

async function fetchUpcomingDebts(userId: string | null): Promise<DigestUpcomingItem[]> {
  if (!userId) return [];

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + UPCOMING_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  try {
    const { data, error } = await supabase
      .from('debts')
      .select('title, party_name, amount, paid_total, due_date, status, type')
      .eq('user_id', userId)
      .neq('status', 'paid')
      .not('due_date', 'is', null)
      .gte('due_date', start.toISOString())
      .lte('due_date', end.toISOString())
      .order('due_date', { ascending: true })
      .limit(UPCOMING_LIMIT * 2);

    if (error) throw error;

    return (data ?? [])
      .map((row) => {
        const dueRaw = typeof row?.due_date === 'string' ? row.due_date : null;
        if (!dueRaw) return null;
        const dueDate = new Date(dueRaw);
        if (Number.isNaN(dueDate.getTime())) return null;
        const days = computeDaysUntil(dueDate);
        if (days < 0 || days > UPCOMING_LOOKAHEAD_DAYS) return null;

        const total = toNumber(row?.amount);
        const paid = toNumber(row?.paid_total);
        const remaining = Math.max(total - paid, 0);
        if (remaining <= 0) return null;

        const rawTitle = typeof row?.title === 'string' ? row.title.trim() : '';
        const rawParty = typeof row?.party_name === 'string' ? row.party_name.trim() : '';
        const label = rawTitle || rawParty;
        const typeLabel = row?.type === 'receivable' ? 'Piutang' : 'Hutang';
        const name = label ? `${typeLabel}: ${label}` : typeLabel;

        return {
          name,
          amount: remaining,
          days,
        } satisfies DigestUpcomingItem;
      })
      .filter((item): item is DigestUpcomingItem => Boolean(item))
      .slice(0, UPCOMING_LIMIT);
  } catch {
    return [];
  }
}

function buildSeenKey(date: string, userId: string): string {
  return `hw_digest_seen_${date}_${userId}`;
}

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export default function useShowDigestOnLogin({
  transactions,
  balanceHint,
}: UseShowDigestOnLoginOptions): UseShowDigestOnLoginResult {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const autoOpenRef = useRef(false);
  const [upcoming, setUpcoming] = useState<DigestUpcomingItem[]>(() => loadUpcomingSubscriptions());
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(() => typeof transactions === 'undefined');

  const data = useMemo(
    () => buildDigestData(transactions ?? null, balanceHint ?? null, upcoming),
    [transactions, balanceHint, upcoming],
  );

  useEffect(() => {
    setTransactionsLoading(typeof transactions === 'undefined');
  }, [transactions]);

  useEffect(() => {
    let active = true;
    setUpcomingLoading(true);
    const subscriptionsUpcoming = loadUpcomingSubscriptions();
    setUpcoming(subscriptionsUpcoming);
    if (!userId) {
      setUpcomingLoading(false);
      return () => {
        active = false;
      };
    }

    fetchUpcomingDebts(userId)
      .then((debts) => {
        if (!active) return;
        setUpcoming(mergeUpcoming(subscriptionsUpcoming, debts));
        setUpcomingLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setUpcoming(subscriptionsUpcoming);
        setUpcomingLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const markSeen = useCallback(
    (uid: string | null, dateKey?: string) => {
      if (!uid) return;
      const today = dateKey ?? data?.todayKey ?? getTodayKey();
      safeSet(buildSeenKey(today, uid), today);
    },
    [data?.todayKey],
  );

  const close = useCallback(() => {
    setOpen(false);
    autoOpenRef.current = false;
    markSeen(userId, data?.todayKey);
  }, [data?.todayKey, markSeen, userId]);

  const openManual = useCallback(() => {
    setOpen(true);
    autoOpenRef.current = false;
  }, []);

  const tryOpenForUser = useCallback(
    (uid: string | null, fromAuthEvent: boolean) => {
      if (!uid) return;
      const today = data?.todayKey ?? getTodayKey();
      const seenKey = buildSeenKey(today, uid);
      const seenToday = safeGet(seenKey) === today;
      const trigger = safeGet(DIGEST_TRIGGER_KEY) === '1';
      if (trigger) {
        safeRemove(DIGEST_TRIGGER_KEY);
      }
      if (seenToday) {
        return;
      }
      if (trigger || fromAuthEvent || !autoOpenRef.current) {
        setOpen(true);
        autoOpenRef.current = true;
      }
    },
    [data?.todayKey],
  );

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const session = data.session ?? null;
        const uid = session?.user?.id ?? null;
        setUserId(uid);
        tryOpenForUser(uid, false);
      })
      .catch(() => {
        if (!active) return;
        setUserId(null);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        setUserId(null);
        setOpen(false);
        autoOpenRef.current = false;
        return;
      }
      if (event === 'SIGNED_IN') {
        const uid = session?.user?.id ?? null;
        setUserId(uid);
        tryOpenForUser(uid, true);
      }
    });

    return () => {
      active = false;
      subscription.subscription?.unsubscribe();
    };
  }, [tryOpenForUser]);

  useEffect(() => {
    if (!userId) return;
    tryOpenForUser(userId, false);
  }, [userId, tryOpenForUser]);

  const loading = upcomingLoading || transactionsLoading;

  return {
    open,
    data,
    loading,
    openManual,
    close,
  };
}
