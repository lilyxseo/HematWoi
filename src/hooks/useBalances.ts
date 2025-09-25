import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { aggregateAccountBalances, type BalanceSummary } from '../lib/balance';
import useSupabaseUser from './useSupabaseUser';

type BalanceState = Pick<BalanceSummary, 'cashTotal' | 'nonCashTotal' | 'allTotal'>;

const INITIAL_STATE: BalanceState = {
  cashTotal: 0,
  nonCashTotal: 0,
  allTotal: 0,
};

interface UseBalancesResult extends BalanceState {
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const isViewNotAvailable = (error: PostgrestError | null): boolean => {
  if (!error) return false;
  return error.code === '42P01' || error.code === '42501' || /does not exist/i.test(error.message);
};

const parseViewAmount = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export default function useBalances(): UseBalancesResult {
  const { user, loading: userLoading } = useSupabaseUser();
  const [state, setState] = useState<BalanceState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const uid = user?.id ?? null;

  useEffect(() => {
    if (userLoading) return undefined;

    let cancelled = false;

    const load = async () => {
      if (!uid) {
        if (!cancelled) {
          setState(INITIAL_STATE);
          setError(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      try {
        const { data: viewData, error: viewError } = await supabase
          .from('v_balance_by_type')
          .select('type,total_balance')
          .eq('user_id', uid);

        if (!cancelled && !viewError && viewData) {
          let cashTotal = 0;
          let allTotal = 0;

          for (const row of viewData) {
            const amount = parseViewAmount((row as { total_balance?: unknown }).total_balance);
            const type = String((row as { type?: unknown }).type ?? '').toLowerCase();
            allTotal += amount;
            if (type === 'cash') {
              cashTotal += amount;
            }
          }

          setState({
            cashTotal,
            nonCashTotal: allTotal - cashTotal,
            allTotal,
          });
          setLoading(false);
          return;
        }

        if (viewError && !isViewNotAvailable(viewError)) {
          throw viewError;
        }

        const { data: accounts, error: accountsError } = await supabase
          .from('accounts')
          .select('id,type')
          .eq('user_id', uid);

        if (accountsError) {
          throw accountsError;
        }

        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('account_id,to_account_id,type,amount,deleted_at')
          .eq('user_id', uid)
          .is('deleted_at', null);

        if (txError) {
          throw txError;
        }

        if (cancelled) return;

        const summary = aggregateAccountBalances(accounts ?? [], transactions ?? []);
        setState({
          cashTotal: summary.cashTotal,
          nonCashTotal: summary.nonCashTotal,
          allTotal: summary.allTotal,
        });
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch balances', err);
        if (!cancelled) {
          setState(INITIAL_STATE);
          setError(err instanceof Error ? err.message : 'Gagal memuat saldo.');
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [uid, userLoading, refreshToken]);

  const refetch = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const result = useMemo<UseBalancesResult>(() => ({
    ...state,
    loading,
    error,
    refetch,
  }), [state, loading, error, refetch]);

  return result;
}
