import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listHighlightedBudgets,
  listHighlightedBudgetRecords,
  toggleHighlight,
  type HighlightBudgetRecord,
  type HighlightBudgetType,
  type HighlightedBudgetItem,
} from '../lib/budgetApi';

interface UseHighlightedBudgetsOptions {
  period: string;
}

interface UseHighlightedBudgetsResult {
  highlights: HighlightedBudgetItem[];
  records: HighlightBudgetRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggle: (input: { type: HighlightBudgetType; id: string }) => Promise<'added' | 'removed'>;
}

const EMPTY: HighlightedBudgetItem[] = [];
const EMPTY_RECORDS: HighlightBudgetRecord[] = [];

export function useHighlightedBudgets({ period }: UseHighlightedBudgetsOptions): UseHighlightedBudgetsResult {
  const [highlights, setHighlights] = useState<HighlightedBudgetItem[]>(EMPTY);
  const [records, setRecords] = useState<HighlightBudgetRecord[]>(EMPTY_RECORDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [recordRows, highlightRows] = await Promise.all([
      listHighlightedBudgetRecords(),
      listHighlightedBudgets(period),
    ]);
    return { recordRows, highlightRows };
  }, [period]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchAll()
      .then(({ recordRows, highlightRows }) => {
        if (!active) return;
        setRecords(recordRows);
        setHighlights(highlightRows);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRecords(EMPTY_RECORDS);
        setHighlights(EMPTY);
        setError(err instanceof Error ? err.message : 'Gagal memuat highlight anggaran');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchAll]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { recordRows, highlightRows } = await fetchAll();
      setRecords(recordRows);
      setHighlights(highlightRows);
    } catch (err) {
      setRecords(EMPTY_RECORDS);
      setHighlights(EMPTY);
      setError(err instanceof Error ? err.message : 'Gagal memuat highlight anggaran');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  const toggleAction = useCallback(
    async (input: { type: HighlightBudgetType; id: string }) => {
      const result = await toggleHighlight(input);
      await refresh();
      return result;
    },
    [refresh]
  );

  return {
    highlights: useMemo(() => highlights, [highlights]),
    records: useMemo(() => records, [records]),
    loading,
    error,
    refresh,
    toggle: toggleAction,
  };
}

export type { HighlightBudgetType, HighlightedBudgetItem };
