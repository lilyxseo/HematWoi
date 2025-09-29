import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildBudgetSummary,
  listBudgetsWithActual,
  type BudgetSummary,
  type BudgetWithActual,
} from '../lib/budgetsApi';

const EMPTY_SUMMARY: BudgetSummary = {
  planned: 0,
  actual: 0,
  remaining: 0,
  progress: 0,
};

export interface UseBudgetsResult {
  rows: BudgetWithActual[];
  summary: BudgetSummary;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useBudgets(period: string): UseBudgetsResult {
  const [rows, setRows] = useState<BudgetWithActual[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBudgets = useCallback(
    async (options?: { signal?: AbortSignal; force?: boolean }) =>
      listBudgetsWithActual({ period, signal: options?.signal, force: options?.force }),
    [period]
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchBudgets({ signal: controller.signal })
      .then((data) => {
        setRows(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) {
          return;
        }
        setRows([]);
        setError(err instanceof Error ? err.message : 'Gagal memuat anggaran');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [fetchBudgets]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBudgets({ force: true });
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Gagal memuat anggaran');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchBudgets]);

  const computedSummary = useMemo(() => buildBudgetSummary(rows), [rows]);

  return {
    rows,
    summary: loading ? EMPTY_SUMMARY : computedSummary,
    loading,
    error,
    refresh,
  };
}

