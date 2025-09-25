import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { formatDateIso } from '../lib/date-range';

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other';

interface DashboardAccount {
  id: string;
  type: AccountType;
}

interface DashboardTransaction {
  account_id: string | number | null;
  to_account_id: string | number | null;
  type: 'income' | 'expense' | string | null;
  amount: number | string | null;
}

interface DashboardTransactionWithDate extends DashboardTransaction {
  date: string | null;
}

export interface UseDashboardBalancesOptions {
  start: Date;
  end: Date;
}

interface DashboardBalancesState {
  income: number;
  expense: number;
  cashBalance: number;
  nonCashBalance: number;
  totalBalance: number;
  loading: boolean;
  error: string | null;
}

export interface DashboardBalancesResult extends DashboardBalancesState {
  refresh: () => Promise<void>;
}

const INITIAL_STATE: DashboardBalancesState = {
  income: 0,
  expense: 0,
  cashBalance: 0,
  nonCashBalance: 0,
  totalBalance: 0,
  loading: true,
  error: null,
};

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function increment(map: Map<string, number>, key: string | null, delta: number) {
  if (!key) return;
  const current = map.get(key) ?? 0;
  map.set(key, current + delta);
}

function normalizeAccountId(value: string | number | null): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function formatSupabaseError(error: PostgrestError | Error | null): string {
  if (!error) return 'Tidak dapat memuat data dashboard saat ini.';
  if ('message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Terjadi kesalahan tak terduga saat memuat data dashboard.';
}

export default function useDashboardBalances({ start, end }: UseDashboardBalancesOptions): DashboardBalancesResult {
  const [state, setState] = useState<DashboardBalancesState>(INITIAL_STATE);
  const mountedRef = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!mountedRef.current) return;

    const currentRequest = ++requestId.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const uid = userData.user?.id ?? null;

      if (!uid) {
        if (!mountedRef.current || requestId.current !== currentRequest) return;
        setState({ ...INITIAL_STATE, loading: false });
        return;
      }

      const [accountsResult, periodTxResult, balanceTxResult] = await Promise.all([
        supabase
          .from('accounts')
          .select('id, type')
          .eq('user_id', uid),
        supabase
          .from('transactions')
          .select('account_id, to_account_id, type, amount, date')
          .eq('user_id', uid)
          .is('deleted_at', null)
          .gte('date', formatDateIso(start))
          .lte('date', formatDateIso(end)),
        supabase
          .from('transactions')
          .select('account_id, to_account_id, type, amount')
          .eq('user_id', uid)
          .is('deleted_at', null),
      ]);

      const accountError = accountsResult.error;
      const periodError = periodTxResult.error;
      const balanceError = balanceTxResult.error;

      if (accountError || periodError || balanceError) {
        throw accountError || periodError || balanceError;
      }

      const accounts = (accountsResult.data ?? []).map<DashboardAccount>((item) => ({
        id: item?.id != null ? String(item.id) : '',
        type:
          item?.type === 'cash' || item?.type === 'bank' || item?.type === 'ewallet' || item?.type === 'other'
            ? item.type
            : 'other',
      }));

      const periodTransactions = (periodTxResult.data ?? []) as DashboardTransactionWithDate[];
      const balanceTransactions = (balanceTxResult.data ?? []) as DashboardTransaction[];

      let income = 0;
      let expense = 0;

      for (const tx of periodTransactions) {
        if (!tx || tx.to_account_id != null) continue;
        const amount = toNumber(tx.amount);
        if (tx.type === 'income') {
          income += amount;
        } else if (tx.type === 'expense') {
          expense += amount;
        }
      }

      const balanceMap = new Map<string, number>();

      for (const tx of balanceTransactions) {
        if (!tx) continue;
        const amount = toNumber(tx.amount);
        const accountId = normalizeAccountId(tx.account_id);
        const toAccountId = normalizeAccountId(tx.to_account_id);

        if (toAccountId) {
          increment(balanceMap, accountId, -amount);
          increment(balanceMap, toAccountId, amount);
          continue;
        }

        if (tx.type === 'income') {
          increment(balanceMap, accountId, amount);
        } else if (tx.type === 'expense') {
          increment(balanceMap, accountId, -amount);
        }
      }

      let cashBalance = 0;
      let nonCashBalance = 0;

      for (const account of accounts) {
        const key = account.id;
        if (!key) continue;
        const balance = balanceMap.get(key) ?? 0;
        if (account.type === 'cash') {
          cashBalance += balance;
        } else {
          nonCashBalance += balance;
        }
      }

      const totalBalance = cashBalance + nonCashBalance;

      if (!mountedRef.current || requestId.current !== currentRequest) return;

      setState({
        income,
        expense,
        cashBalance,
        nonCashBalance,
        totalBalance,
        loading: false,
        error: null,
      });
    } catch (error) {
      if (!mountedRef.current || requestId.current !== currentRequest) return;
      setState({ ...INITIAL_STATE, loading: false, error: formatSupabaseError(error as PostgrestError | Error) });
    }
  }, [start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return useMemo(
    () => ({
      ...state,
      refresh,
    }),
    [state, refresh],
  );
}
