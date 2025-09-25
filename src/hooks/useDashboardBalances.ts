import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const JAKARTA_OFFSET_HOURS = 7;
const JAKARTA_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

type AccountRecord = {
  id: string;
  type: 'cash' | 'bank' | 'ewallet' | 'other';
};

type TransactionRecord = {
  id?: string;
  account_id: string | null;
  to_account_id: string | null;
  type: 'income' | 'expense';
  amount: number;
  date?: string;
};

type DashboardBalancesOptions = {
  start: Date;
  end: Date;
};

type DashboardBalancesData = {
  income: number;
  expense: number;
  cashBalance: number;
  nonCashBalance: number;
  totalBalance: number;
  netTrend: number[];
};

export type DashboardBalancesResult = DashboardBalancesData & {
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const initialData: DashboardBalancesData = {
  income: 0,
  expense: 0,
  cashBalance: 0,
  nonCashBalance: 0,
  totalBalance: 0,
  netTrend: [],
};

function toJakartaISOString(date: Date, endOfDay = false): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = endOfDay ? 23 : 0;
  const minutes = endOfDay ? 59 : 0;
  const seconds = endOfDay ? 59 : 0;
  const milliseconds = endOfDay ? 999 : 0;

  const utcTimestamp = Date.UTC(
    year,
    month,
    day,
    hours - JAKARTA_OFFSET_HOURS,
    minutes,
    seconds,
    milliseconds
  );

  return new Date(utcTimestamp).toISOString();
}

function jakartaDateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return JAKARTA_DATE_FORMAT.format(date);
}

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

function extractErrorMessage<T>(response: PostgrestSingleResponse<T>): string {
  return response.error?.message ?? 'Terjadi kesalahan saat memuat data.';
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export default function useDashboardBalances(
  options: DashboardBalancesOptions
): DashboardBalancesResult {
  const { start, end } = options;
  const [data, setData] = useState<DashboardBalancesData>(initialData);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: userData,
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        const uid = userData.user?.id;
        if (!uid) {
          throw new Error('Pengguna tidak ditemukan.');
        }

        const [accountsRes, periodTxRes, balanceTxRes] = await Promise.all([
          supabase
            .from('accounts')
            .select('id, type')
            .eq('user_id', uid),
          supabase
            .from('transactions')
            .select(
              'id, account_id, to_account_id, type, amount, date, deleted_at'
            )
            .eq('user_id', uid)
            .is('deleted_at', null)
            .gte('date', toJakartaISOString(start, false))
            .lte('date', toJakartaISOString(end, true)),
          supabase
            .from('transactions')
            .select('account_id, to_account_id, type, amount, deleted_at')
            .eq('user_id', uid)
            .is('deleted_at', null),
        ]);

        if (accountsRes.error) throw new Error(extractErrorMessage(accountsRes));
        if (periodTxRes.error) throw new Error(extractErrorMessage(periodTxRes));
        if (balanceTxRes.error) throw new Error(extractErrorMessage(balanceTxRes));

        const accounts = (accountsRes.data ?? []) as AccountRecord[];
        const periodTxs = (periodTxRes.data ?? []) as TransactionRecord[];
        const balanceTxs = (balanceTxRes.data ?? []) as TransactionRecord[];

        const income = sum(
          periodTxs
            .filter((tx) => tx.type === 'income' && !tx.to_account_id)
            .map((tx) => toNumber(tx.amount))
        );

        const expense = sum(
          periodTxs
            .filter((tx) => tx.type === 'expense' && !tx.to_account_id)
            .map((tx) => toNumber(tx.amount))
        );

        const balances = new Map<string, number>();
        const increment = (accountId: string | null, amount: number) => {
          if (!accountId) return;
          balances.set(accountId, (balances.get(accountId) ?? 0) + amount);
        };

        for (const tx of balanceTxs) {
          const amount = toNumber(tx.amount);

          if (!tx.to_account_id) {
            if (tx.type === 'income') {
              increment(tx.account_id, amount);
            } else if (tx.type === 'expense') {
              increment(tx.account_id, -amount);
            }
          }

          if (tx.to_account_id) {
            increment(tx.account_id, -amount);
            increment(tx.to_account_id, amount);
          }
        }

        const cashBalance = sum(
          accounts
            .filter((account) => account.type === 'cash')
            .map((account) => balances.get(account.id) ?? 0)
        );

        const nonCashBalance = sum(
          accounts
            .filter((account) => account.type !== 'cash')
            .map((account) => balances.get(account.id) ?? 0)
        );

        const totalBalance = cashBalance + nonCashBalance;

        const netByDate = new Map<string, number>();
        for (const tx of periodTxs) {
          if (tx.to_account_id) continue;
          const amount = toNumber(tx.amount);
          const dateKey = tx.date ? jakartaDateKey(tx.date) : null;
          if (!dateKey) continue;
          const current = netByDate.get(dateKey) ?? 0;
          if (tx.type === 'income') {
            netByDate.set(dateKey, current + amount);
          } else if (tx.type === 'expense') {
            netByDate.set(dateKey, current - amount);
          }
        }

        const sortedNet = Array.from(netByDate.entries())
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([, value]) => value);

        if (active) {
          setData({
            income,
            expense,
            cashBalance,
            nonCashBalance,
            totalBalance,
            netTrend: sortedNet,
          });
          setLoading(false);
        }
      } catch (err) {
        if (!active) return;
        setLoading(false);
        setData(initialData);
        setError(
          err instanceof Error
            ? err.message
            : 'Terjadi kesalahan saat memuat data.'
        );
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [start, end, refreshKey]);

  return useMemo(
    () => ({
      ...data,
      loading,
      error,
      refresh,
    }),
    [data, loading, error, refresh]
  );
}
