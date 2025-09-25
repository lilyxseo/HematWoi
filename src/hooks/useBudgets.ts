import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assembleBudgets,
  buildSummary,
  type BudgetSummary,
  type BudgetWithSpent,
} from '../repo/budgetApi';

interface UseBudgetsResult {
  rows: BudgetWithSpent[];
  summary: BudgetSummary;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY_SUMMARY: BudgetSummary = {
  planned: 0,
  spent: 0,
  remaining: 0,
  percentage: 0,
};

export default function useBudgets(period: string): UseBudgetsResult {
  const [rows, setRows] = useState<BudgetWithSpent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => buildSummary(rows), [rows]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await assembleBudgets(period);
      setRows(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat anggaran';
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    rows,
    summary: rows.length ? summary : EMPTY_SUMMARY,
    loading,
    error,
    refresh,
  };
}
