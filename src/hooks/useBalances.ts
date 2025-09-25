import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import useSupabaseUser from './useSupabaseUser';
import { calculateAccountBalances, type AccountRow, type TransactionRow } from '../lib/balance-utils';

interface BalanceState {
  cashTotal: number;
  nonCashTotal: number;
  allTotal: number;
}

const EMPTY_STATE: BalanceState = {
  cashTotal: 0,
  nonCashTotal: 0,
  allTotal: 0,
};

function isMissingViewError(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true;
  const message = error.message?.toLowerCase() ?? '';
  return (
    message.includes('relation') && message.includes('does not exist')
  ) || message.includes('v_balance_by_type');
}

async function fetchBalancesFromView(userId: string): Promise<BalanceState | null> {
  const { data, error } = await supabase
    .from('v_balance_by_type')
    .select('type,total_balance')
    .eq('user_id', userId);

  if (error) {
    if (isMissingViewError(error)) {
      return null;
    }
    throw error;
  }

  const rows = data ?? [];
  let cashTotal = 0;
  let allTotal = 0;

  for (const row of rows) {
    const balance = Number(row?.total_balance ?? 0) || 0;
    allTotal += balance;
    if ((row?.type ?? '').toLowerCase() === 'cash') {
      cashTotal += balance;
    }
  }

  return {
    cashTotal,
    allTotal,
    nonCashTotal: allTotal - cashTotal,
  };
}

async function fetchBalancesManually(userId: string): Promise<BalanceState> {
  const { data: accounts, error: accountError } = await supabase
    .from('accounts')
    .select('id,type')
    .eq('user_id', userId);

  if (accountError) {
    throw accountError;
  }

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('account_id,to_account_id,type,amount')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (txError) {
    throw txError;
  }

  const result = calculateAccountBalances(
    (accounts ?? []) as AccountRow[],
    (transactions ?? []) as TransactionRow[],
  );

  return {
    cashTotal: result.cashTotal,
    allTotal: result.allTotal,
    nonCashTotal: result.nonCashTotal,
  };
}

export default function useBalances() {
  const { user, loading: userLoading } = useSupabaseUser();
  const [state, setState] = useState<BalanceState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const userId = user?.id ?? null;

  const refetch = useCallback(() => {
    setRefreshToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!userId) {
      if (!userLoading) {
        setState(EMPTY_STATE);
        setLoading(false);
      }
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const viaView = await fetchBalancesFromView(userId);
        if (!active) return;
        if (viaView) {
          setState(viaView);
          setLoading(false);
          return;
        }

        const manual = await fetchBalancesManually(userId);
        if (!active) return;
        setState(manual);
        setLoading(false);
      } catch (_err) {
        if (!active) return;
        setError('Terjadi kesalahan saat memuat saldo.');
        setState(EMPTY_STATE);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, refreshToken, userLoading]);

  return useMemo(
    () => ({
      cashTotal: state.cashTotal,
      nonCashTotal: state.nonCashTotal,
      allTotal: state.allTotal,
      loading: loading || userLoading,
      error,
      refetch,
    }),
    [state, loading, userLoading, error, refetch],
  );
}
