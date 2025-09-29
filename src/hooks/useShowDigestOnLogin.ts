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

function loadUpcomingSubscriptions(): DigestUpcomingItem[] {
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

function combineUpcoming(...groups: Array<DigestUpcomingItem[] | null | undefined>): DigestUpcomingItem[] {
  return groups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .filter((item): item is DigestUpcomingItem =>
      Boolean(item) && Number.isFinite(item.days) && item.days >= 0,
    )
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);
}

async function fetchUpcomingDebts(windowDays = 7): Promise<DigestUpcomingItem[]> {
  try {
    const todayKey = getTodayKey();
    const start = new Date(`${todayKey}T00:00:00+07:00`);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + windowDays);
    const endKey = DATE_FORMATTER.format(end);

    const { data, error } = await supabase
      .from('debts')
      .select('title, party_name, due_date, amount, paid_total, status, type')
      .neq('status', 'paid')
      .eq('type', 'debt')
      .not('due_date', 'is', null)
      .gte('due_date', todayKey)
      .lte('due_date', endKey)
      .order('due_date', { ascending: true })
      .limit(20);

    if (error) throw error;

    return (data ?? [])
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        const dueKey = getDateKey((row?.due_date as string | null | undefined) ?? null);
        if (!dueKey) return null;
        const due = new Date(`${dueKey}T00:00:00+07:00`);
        if (Number.isNaN(due.getTime())) return null;
        const days = Math.round((due.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        if (!Number.isFinite(days) || days < 0 || days > windowDays) return null;
        const amountValue = row?.amount as number | string | null | undefined;
        const paidValue = row?.paid_total as number | string | null | undefined;
        const amount = Math.max(toNumber(amountValue) - toNumber(paidValue), 0);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        const title = typeof row?.title === 'string' ? row.title.trim() : '';
        const party = typeof row?.party_name === 'string' ? row.party_name.trim() : '';
        const name = title || (party ? `Hutang ${party}` : 'Hutang');
        return { name, amount, days } satisfies DigestUpcomingItem;
      })
      .filter((item): item is DigestUpcomingItem => Boolean(item))
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
  } catch (error) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error('[HW] digest upcoming debts', error);
    }
    return [];
  }
}

function buildDigestData(
  transactions: DigestTransactionLike[] | null | undefined,
  balanceHint: number | null | undefined,
  upcoming: DigestUpcomingItem[] | null | undefined,
): DailyDigestModalData {
  const todayKey = getTodayKey();
  const monthKey = todayKey.slice(0, 7);
  const todayLabel = HUMAN_FORMATTER.format(new Date(`${todayKey}T00:00:00+07:00`));
  const monthLabel = MONTH_LABEL_FORMATTER.format(new Date(`${todayKey}T00:00:00+07:00`));

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

  const resolvedUpcoming = Array.isArray(upcoming) && upcoming.length > 0 ? upcoming : null;

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
    upcoming: combineUpcoming(resolvedUpcoming ?? loadUpcomingSubscriptions()),
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
  const autoOpenRef = useRef(false);
  const [upcoming, setUpcoming] = useState<DigestUpcomingItem[]>(() =>
    combineUpcoming(loadUpcomingSubscriptions()),
  );

  const data = useMemo(
    () => buildDigestData(transactions ?? null, balanceHint ?? null, upcoming),
    [transactions, balanceHint, upcoming],
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
    let canceled = false;
    async function refreshUpcoming(uid: string | null) {
      const base = loadUpcomingSubscriptions();
      if (!uid) {
        if (!canceled) {
          setUpcoming(combineUpcoming(base));
        }
        return;
      }
      const debts = await fetchUpcomingDebts(7);
      if (!canceled) {
        setUpcoming(combineUpcoming(base, debts));
      }
    }
    refreshUpcoming(userId);
    return () => {
      canceled = true;
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
