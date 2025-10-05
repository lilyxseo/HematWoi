import { useCallback, useEffect, useState } from 'react';
import {
  listWeeklyBudgets,
  type WeeklyBudgetCategorySummary,
  type WeeklyBudgetWithSpent,
} from '../lib/budgetApi';

export interface UseWeeklyBudgetsResult {
  rows: WeeklyBudgetWithSpent[];
  summaryByCategory: WeeklyBudgetCategorySummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWeeklyBudgets(period: string): UseWeeklyBudgetsResult {
  const [rows, setRows] = useState<WeeklyBudgetWithSpent[]>([]);
  const [summary, setSummary] = useState<WeeklyBudgetCategorySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listWeeklyBudgets(period);
    return result;
  }, [period]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    load()
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setSummary(result.summaryByCategory);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRows([]);
        setSummary([]);
        setError(err instanceof Error ? err.message : 'Gagal memuat anggaran mingguan');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await load();
      setRows(result.rows);
      setSummary(result.summaryByCategory);
    } catch (err) {
      setRows([]);
      setSummary([]);
      setError(err instanceof Error ? err.message : 'Gagal memuat anggaran mingguan');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [load]);

  return {
    rows,
    summaryByCategory: summary,
    loading,
    error,
    refresh,
  };
}

