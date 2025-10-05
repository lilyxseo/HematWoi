import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listWeeklyBudgets,
  type WeeklyBudgetSummaryRow,
  type WeeklyBudgetWithActual,
  type WeeklyBudgetsResult,
} from '../lib/budgetApi';

interface UseWeeklyBudgetsResult extends WeeklyBudgetsResult {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY_RESULT: WeeklyBudgetsResult = {
  rows: [],
  summaries: [],
};

export function useWeeklyBudgets(period: string): UseWeeklyBudgetsResult {
  const [state, setState] = useState<WeeklyBudgetsResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const result = await listWeeklyBudgets(period);
    return result;
  }, [period]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchData()
      .then((result) => {
        if (!active) return;
        setState(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState(EMPTY_RESULT);
        setError(err instanceof Error ? err.message : 'Gagal memuat anggaran mingguan');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchData]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchData();
      setState(result);
    } catch (err) {
      setState(EMPTY_RESULT);
      setError(err instanceof Error ? err.message : 'Gagal memuat anggaran mingguan');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const memoResult = useMemo(() => state, [state]);

  return {
    rows: memoResult.rows,
    summaries: memoResult.summaries,
    loading,
    error,
    refresh,
  };
}

export type { WeeklyBudgetSummaryRow, WeeklyBudgetWithActual };
