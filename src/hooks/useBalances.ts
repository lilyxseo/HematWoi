import { useCallback, useEffect, useRef, useState } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import useSupabaseUser from './useSupabaseUser';
import {
  aggregateAccountBalances,
  type AccountSummary,
  type TransactionSummary,
} from '../lib/balances';

interface BalanceState {
  cashTotal: number;
  nonCashTotal: number;
  allTotal: number;
  loading: boolean;
  error: Error | null;
}

const INITIAL_TOTALS = {
  cashTotal: 0,
  nonCashTotal: 0,
  allTotal: 0,
};

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    return new Error(message);
  }
  return new Error('Terjadi kesalahan tak terduga.');
}

function isMissingView(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST202') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('relation') && message.includes('does not exist');
}

export default function useBalances() {
  const { user, loading: userLoading } = useSupabaseUser();
  const [state, setState] = useState<BalanceState>({
    ...INITIAL_TOTALS,
    loading: true,
    error: null,
  });
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const setSafeState = useCallback((updater: BalanceState | ((prev: BalanceState) => BalanceState)) => {
    if (!isMounted.current) return;
    setState(updater);
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!isMounted.current) return;

    const userId = user?.id;
    if (!userId) {
      setSafeState({ ...INITIAL_TOTALS, loading: false, error: null });
      return;
    }

    setSafeState((prev) => ({ ...prev, loading: true, error: null }));

    const { data: viewData, error: viewError } = await supabase
      .from('v_balance_by_type')
      .select('type,total_balance')
      .eq('user_id', userId);

    if (!isMounted.current) return;

    if (!viewError && Array.isArray(viewData)) {
      let cashTotal = 0;
      let allTotal = 0;

      for (const row of viewData) {
        const amount = Number(row?.total_balance ?? 0) || 0;
        allTotal += amount;
        if (row?.type === 'cash') {
          cashTotal += amount;
        }
      }

      setSafeState({
        cashTotal,
        allTotal,
        nonCashTotal: allTotal - cashTotal,
        loading: false,
        error: null,
      });
      return;
    }

    if (viewError && !isMissingView(viewError)) {
      setSafeState({ ...INITIAL_TOTALS, loading: false, error: normalizeError(viewError) });
      return;
    }

    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id,type')
      .eq('user_id', userId);

    if (!isMounted.current) return;

    if (accountError) {
      setSafeState({ ...INITIAL_TOTALS, loading: false, error: normalizeError(accountError) });
      return;
    }

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('account_id,to_account_id,type,amount')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!isMounted.current) return;

    if (txError) {
      setSafeState({ ...INITIAL_TOTALS, loading: false, error: normalizeError(txError) });
      return;
    }

    const aggregation = aggregateAccountBalances(
      (accounts ?? []) as AccountSummary[],
      (transactions ?? []) as TransactionSummary[]
    );

    setSafeState({
      cashTotal: aggregation.cashTotal,
      nonCashTotal: aggregation.nonCashTotal,
      allTotal: aggregation.allTotal,
      loading: false,
      error: null,
    });
  }, [setSafeState, user?.id]);

  useEffect(() => {
    if (userLoading) return;
    fetchBalances();
  }, [userLoading, fetchBalances]);

  const refetch = useCallback(() => {
    if (userLoading) return;
    fetchBalances();
  }, [fetchBalances, userLoading]);

  return {
    cashTotal: state.cashTotal,
    nonCashTotal: state.nonCashTotal,
    allTotal: state.allTotal,
    loading: state.loading,
    error: state.error,
    refetch,
  } as const;
}
