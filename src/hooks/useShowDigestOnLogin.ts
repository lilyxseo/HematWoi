import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { findUpcoming, loadSubscriptions } from '../lib/subscriptions';

const TIMEZONE = 'Asia/Jakarta';
const TIMEZONE_OFFSET = '+07:00';
const UPCOMING_WINDOW_DAYS = 7;
const UPCOMING_LIMIT = 4;
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
  topTodayExpenses: Array<{ name: string; amount: number }>;
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

function loadSubscriptionUpcoming(): DigestUpcomingItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const subscriptions = loadSubscriptions();
    return findUpcoming(subscriptions, UPCOMING_WINDOW_DAYS)
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

function calculateDaysUntil(value: string | null | undefined): number | null {
  const dateKey = getDateKey(value);
  if (!dateKey) return null;
  const todayKey = getTodayKey();
  const today = new Date(`${todayKey}T00:00:00${TIMEZONE_OFFSET}`);
  const due = new Date(`${dateKey}T00:00:00${TIMEZONE_OFFSET}`);
  const diff = due.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function buildDebtName(row: { title?: string | null; party_name?: string | null }): string {
  const title = typeof row?.title === 'string' ? row.title.trim() : '';
  if (title) return title;
  const party = typeof row?.party_name === 'string' ? row.party_name.trim() : '';
  if (party) return party;
  return 'Hutang';
}

async function fetchUpcomingDebts(userId: string): Promise<DigestUpcomingItem[]> {
  try {
    const todayKey = getTodayKey();
    const endKey = DATE_FORMATTER.format(
      new Date(new Date(`${todayKey}T00:00:00${TIMEZONE_OFFSET}`).getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000),
    );
    const fromIso = `${todayKey}T00:00:00${TIMEZONE_OFFSET}`;
    const toIso = `${endKey}T23:59:59${TIMEZONE_OFFSET}`;

    const { data, error } = await supabase
      .from('debts')
      .select('title, party_name, amount, paid_total, due_date, status, type')
      .eq('user_id', userId)
      .eq('type', 'debt')
      .not('due_date', 'is', null)
      .in('status', ['ongoing', 'overdue'])
      .gte('due_date', fromIso)
      .lte('due_date', toIso);

    if (error) {
      throw error;
    }

    return (data ?? [])
      .map((row) => {
        const remaining = Math.max(0, toNumber(row?.amount) - toNumber(row?.paid_total));
        const days = calculateDaysUntil(row?.due_date ?? null);
        if (remaining <= 0 || days == null) {
          return null;
        }
        return {
          name: buildDebtName(row ?? {}),
          amount: remaining,
          days,
        } satisfies DigestUpcomingItem;
      })
      .filter((item): item is DigestUpcomingItem => Boolean(item && item.days >= 0 && item.days <= UPCOMING_WINDOW_DAYS));
  } catch (error) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error('[HW][Digest] Failed to load upcoming debts', error);
    }
    return [];
  }
}

function mergeUpcomingLists(...lists: DigestUpcomingItem[][]): DigestUpcomingItem[] {
  const merged = lists
    .flat()
    .filter((item): item is DigestUpcomingItem => Boolean(item));
  merged.sort((a, b) => a.days - b.days);
  return merged.slice(0, UPCOMING_LIMIT);
}

function buildDigestData(
  transactions: DigestTransactionLike[] | null | undefined,
  balanceHint: number | null | undefined,
  upcomingItems: DigestUpcomingItem[],
): DailyDigestModalData {
  const todayKey = getTodayKey();
  const monthKey = todayKey.slice(0, 7);
  const todayLabel = HUMAN_FORMATTER.format(new Date(`${todayKey}T00:00:00${TIMEZONE_OFFSET}`));
  const monthLabel = MONTH_LABEL_FORMATTER.format(new Date(`${todayKey}T00:00:00${TIMEZONE_OFFSET}`));

  let computedBalance = 0;
  let todayIncome = 0;
  let todayExpense = 0;
  let todayCount = 0;
  const todayCategoryTotals = new Map<string, number>();

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
        const category = typeof tx?.category === 'string' ? tx.category.trim() : '';
        const label = category || 'Tanpa kategori';
        todayCategoryTotals.set(label, (todayCategoryTotals.get(label) || 0) + amount);
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
    topTodayExpenses,
    upcoming: [...upcomingItems],
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
  balanceHint,
}: UseShowDigestOnLoginOptions): UseShowDigestOnLoginResult {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [debtUpcoming, setDebtUpcoming] = useState<DigestUpcomingItem[]>([]);
  const autoOpenRef = useRef(false);

  const subscriptionUpcoming = useMemo(() => loadSubscriptionUpcoming(), []);
  const combinedUpcoming = useMemo(
    () => mergeUpcomingLists(subscriptionUpcoming, debtUpcoming),
    [subscriptionUpcoming, debtUpcoming],
  );

  const data = useMemo(
    () => buildDigestData(transactions ?? null, balanceHint ?? null, combinedUpcoming),
    [transactions, balanceHint, combinedUpcoming],
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

  useEffect(() => {
    let active = true;
    if (!userId) {
      setDebtUpcoming([]);
      return () => {
        active = false;
      };
    }

    fetchUpcomingDebts(userId)
      .then((items) => {
        if (!active) return;
        setDebtUpcoming(items);
      })
      .catch(() => {
        if (!active) return;
        setDebtUpcoming([]);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return {
    open,
    data,
    loading: false,
    openManual,
    close,
  };
}
