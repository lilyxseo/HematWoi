import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import useSupabaseUser from './useSupabaseUser';
import {
  type AccountRow,
  type AggregateResult,
  type TransactionRow,
  aggregateAccountBalances,
} from '../lib/balances';

interface BalanceState {
  cashTotal: number;
  nonCashTotal: number;
  allTotal: number;
}

const ZERO_STATE: BalanceState = Object.freeze({
  cashTotal: 0,
  nonCashTotal: 0,
  allTotal: 0,
});

export interface UseBalancesResult extends BalanceState {
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export default function useBalances(): UseBalancesResult {
  const { user, loading: userLoading } = useSupabaseUser();
  const [state, setState] = useState<BalanceState>(ZERO_STATE);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const fetchBalances = useCallback(
    async (isActive: () => boolean) => {
      if (!user) {
        if (!isActive()) return;
        setState(ZERO_STATE);
        setError(null);
        setLoading(false);
        return;
      }

      if (!isActive()) return;
      setLoading(true);
      setError(null);

      try {
        const { data: accounts, error: accountError } = await supabase
          .from('accounts')
          .select('id, type')
          .eq('user_id', user.id);

        if (accountError) {
          throw accountError;
        }

        const { data: transactions, error: transactionsError } = await supabase
          .from('transactions')
          .select('account_id, to_account_id, type, amount, deleted_at')
          .eq('user_id', user.id)
          .is('deleted_at', null);

        if (transactionsError) {
          throw transactionsError;
        }

        if (!isActive()) return;

        const result: AggregateResult = aggregateAccountBalances(
          (accounts as AccountRow[]) ?? [],
          (transactions as TransactionRow[]) ?? []
        );

        setState({
          cashTotal: result.cashTotal,
          nonCashTotal: result.nonCashTotal,
          allTotal: result.allTotal,
        });
        setLoading(false);
      } catch (err) {
        if (!isActive()) return;
        const handledError = err instanceof Error ? err : new Error('Gagal memuat saldo');
        setError(handledError);
        setState(ZERO_STATE);
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (userLoading) {
      setLoading(true);
      return;
    }

    let active = true;

    fetchBalances(() => active);

    return () => {
      active = false;
    };
  }, [userLoading, fetchBalances, reloadToken]);

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const memoizedState = useMemo(
    () => ({
      cashTotal: state.cashTotal,
      nonCashTotal: state.nonCashTotal,
      allTotal: state.allTotal,
    }),
    [state]
  );

  return {
    ...memoizedState,
    loading: userLoading || loading,
    error,
    refetch,
  };
}
