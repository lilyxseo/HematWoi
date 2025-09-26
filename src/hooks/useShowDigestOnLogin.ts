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

export interface DigestTransactionLike {
  amount?: number | string | null;
  type?: string | null;
  date?: string | null;
  category?: string | null;
}

export interface DigestBudgetLike {
  amount_planned?: number | string | null;
  planned?: number | string | null;
  limit?: number | string | null;
  cap?: number | string | null;
  amount?: number | string | null;
  month?: string | null;
}

export interface DigestUpcomingItem {
  name: string;
  amount: number;
  days: number;
}

export interface DailyDigestModalData {
  todayKey: string;
  todayLabel: string;
  monthKey: string;
  monthLabel: string;
  balance: number;
  todayIncome: number;
  todayExpense: number;
  todayNet: number;
  todayCount: number;
  monthExpense: number;
  monthBudget: number;
  monthVariance: number;
  monthProgress: number;
  topCategory: { name: string; amount: number } | null;
  upcoming: DigestUpcomingItem[];
}

export interface UseShowDigestOnLoginOptions {
  transactions?: DigestTransactionLike[] | null;
  budgets?: DigestBudgetLike[] | null;
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

function getDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return DATE_FORMATTER.format(parsed);
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

function resolveBudgetAmount(budget: DigestBudgetLike | null | undefined): number {
  if (!budget) return 0;
  const fields: Array<keyof DigestBudgetLike> = [
    'amount_planned',
    'planned',
    'limit',
    'cap',
    'amount',
  ];
  for (const field of fields) {
    const raw = budget[field];
    if (raw === null || raw === undefined) continue;
    const numeric = toNumber(raw);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return 0;
}

function loadUpcoming(): DigestUpcomingItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const subscriptions = loadSubscriptions();
    return findUpcoming(subscriptions, 7)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4)
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
  budgets: DigestBudgetLike[] | null | undefined,
  balanceHint: number | null | undefined,
): DailyDigestModalData {
  const todayKey = getTodayKey();
  const monthKey = todayKey.slice(0, 7);
  const todayLabel = HUMAN_FORMATTER.format(new Date(`${todayKey}T00:00:00+07:00`));
  const monthLabel = MONTH_LABEL_FORMATTER.format(new Date(`${todayKey}T00:00:00+07:00`));

  let computedBalance = 0;
  let todayIncome = 0;
  let todayExpense = 0;
  let todayCount = 0;
  let monthExpense = 0;
  const categoryTotals = new Map<string, number>();

  for (const tx of transactions ?? []) {
    const type = typeof tx?.type === 'string' ? tx.type.toLowerCase() : '';
    const amount = toNumber(tx?.amount);
    const dateKey = getDateKey(tx?.date ?? null);
    if (!dateKey) continue;

    if (type === 'income') {
      computedBalance += amount;
      if (dateKey === todayKey) {
        todayIncome += amount;
      }
    } else if (type === 'expense') {
      computedBalance -= amount;
      if (dateKey === todayKey) {
        todayExpense += amount;
        if (amount > 0) {
          todayCount += 1;
        }
      }
      if (dateKey.startsWith(monthKey)) {
        monthExpense += amount;
        const category = typeof tx?.category === 'string' ? tx.category.trim() : '';
        if (category) {
          categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
        }
      }
    }
  }

  const resolvedBalance =
    typeof balanceHint === 'number' && Number.isFinite(balanceHint)
      ? balanceHint
      : computedBalance;

  const monthBudget = (budgets ?? [])
    .filter((budget) => {
      if (!budget?.month) return true;
      const normalized = String(budget.month).slice(0, 7);
      return normalized === monthKey;
    })
    .reduce((sum, budget) => sum + resolveBudgetAmount(budget), 0);

  const monthVariance = monthBudget - monthExpense;
  const monthProgress = monthBudget > 0 ? Math.min(1, monthExpense / monthBudget) : 0;

  const topCategoryEntry = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .at(0);

  const topCategory = topCategoryEntry
    ? { name: topCategoryEntry[0], amount: topCategoryEntry[1] }
    : null;

  const todayNet = todayIncome - todayExpense;

  return {
    todayKey,
    todayLabel,
    monthKey,
    monthLabel,
    balance: resolvedBalance,
    todayIncome,
    todayExpense,
    todayNet,
    todayCount,
    monthExpense,
    monthBudget,
    monthVariance,
    monthProgress,
    topCategory,
    upcoming: loadUpcoming(),
  };
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
  budgets,
  balanceHint,
}: UseShowDigestOnLoginOptions): UseShowDigestOnLoginResult {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const autoOpenRef = useRef(false);

  const data = useMemo(
    () => buildDigestData(transactions ?? null, budgets ?? null, balanceHint ?? null),
    [transactions, budgets, balanceHint],
  );

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
      if (trigger || fromAuthEvent) {
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
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
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

  return {
    open,
    data,
    loading: false,
    openManual,
    close,
  };
}
