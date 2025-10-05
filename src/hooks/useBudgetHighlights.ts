import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listHighlightBudgets,
  toggleHighlight as toggleHighlightApi,
  type BudgetType,
  type HighlightBudgetRecord,
} from '../lib/budgetApi';

export interface UseBudgetHighlightsResult {
  highlights: HighlightBudgetRecord[];
  loading: boolean;
  isHighlighted: (type: BudgetType, id: string) => boolean;
  toggleHighlight: (type: BudgetType, id: string) => Promise<'added' | 'removed'>;
  refresh: () => Promise<void>;
}

export function useBudgetHighlights(): UseBudgetHighlightsResult {
  const [highlights, setHighlights] = useState<HighlightBudgetRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    const data = await listHighlightBudgets();
    setHighlights(data);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh()
      .catch((err) => {
        if (!active) return;
        console.error('[HW] gagal memuat highlight', err);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const handleToggle = useCallback(
    async (type: BudgetType, id: string) => {
      const result = await toggleHighlightApi({ type, id });
      await refresh();
      return result;
    },
    [refresh]
  );

  const highlightSet = useMemo(() => {
    const map = new Map<string, HighlightBudgetRecord>();
    for (const item of highlights) {
      map.set(`${item.budget_type}:${item.budget_id}`, item);
    }
    return map;
  }, [highlights]);

  const isHighlighted = useCallback(
    (type: BudgetType, id: string) => highlightSet.has(`${type}:${id}`),
    [highlightSet]
  );

  return {
    highlights,
    loading,
    isHighlighted,
    toggleHighlight: handleToggle,
    refresh,
  };
}
