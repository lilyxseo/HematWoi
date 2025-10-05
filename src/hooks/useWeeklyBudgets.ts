import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listWeeklyBudgets,
  type WeeklyBudgetCategorySummary,
  type WeeklyBudgetWithActual,
} from '../lib/budgetApi';

export interface UseWeeklyBudgetsResult {
  rows: WeeklyBudgetWithActual[];
  summaries: WeeklyBudgetCategorySummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY_SUMMARIES: WeeklyBudgetCategorySummary[] = [];

export function useWeeklyBudgets(period: string): UseWeeklyBudgetsResult {
  const [rows, setRows] = useState<WeeklyBudgetWithActual[]>([]);
  const [summaries, setSummaries] = useState<WeeklyBudgetCategorySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
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
        setRows(result.rows);
        setSummaries(result.summaries);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRows([]);
        setSummaries([]);
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
      setRows(result.rows);
      setSummaries(result.summaries);
    } catch (err) {
      setRows([]);
      setSummaries([]);
      setError(err instanceof Error ? err.message : 'Gagal memuat anggaran mingguan');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const memoSummaries = useMemo(() => (loading && summaries.length === 0 ? EMPTY_SUMMARIES : summaries), [loading, summaries]);

  return {
    rows,
    summaries: memoSummaries,
    loading,
    error,
    refresh,
  };
}
