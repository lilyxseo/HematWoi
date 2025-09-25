import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildSummary,
  computeSpent,
  listBudgets,
  mergeBudgetsWithSpent,
  type BudgetSummary,
  type BudgetWithSpent,
} from '../lib/budgetApi';

const EMPTY_SUMMARY: BudgetSummary = {
  planned: 0,
  spent: 0,
  remaining: 0,
  percentage: 0,
};

export interface UseBudgetsResult {
  rows: BudgetWithSpent[];
  summary: BudgetSummary;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBudgets(period: string): UseBudgetsResult {
  const [rows, setRows] = useState<BudgetWithSpent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCombined = useCallback(async () => {
    const [budgetRows, spentMap] = await Promise.all([listBudgets(period), computeSpent(period)]);
    return mergeBudgetsWithSpent(budgetRows, spentMap);
  }, [period]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchCombined()
      .then((merged) => {
        if (!active) return;
        setRows(merged);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRows([]);
        setError(err instanceof Error ? err.message : 'Gagal memuat anggaran');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchCombined]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const merged = await fetchCombined();
      setRows(merged);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Gagal memuat anggaran');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchCombined]);

  const summary = useMemo(() => buildSummary(rows), [rows]);

  return {
    rows,
    summary: loading && rows.length === 0 ? EMPTY_SUMMARY : summary,
    loading,
    error,
    refresh,
  };
}

