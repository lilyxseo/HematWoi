import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listHighlightBudgets, type HighlightBudgetSelection } from '../lib/budgetApi';

const DEBUG =
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
  process.env?.NODE_ENV === 'development';

export const HIGHLIGHT_BUDGETS_QUERY_KEY = ['budgets', 'highlights'] as const;

export function useHighlightBudgets(userId?: string | null, options: { enabled?: boolean } = {}) {
  const isEnabled = Boolean(userId) && (options.enabled ?? true);

  useEffect(() => {
    if (!DEBUG) return;
    // eslint-disable-next-line no-console
    console.debug('[highlight:query]', [...HIGHLIGHT_BUDGETS_QUERY_KEY, userId ?? 'guest']);
  }, [userId]);

  return useQuery<HighlightBudgetSelection[]>({
    queryKey: [...HIGHLIGHT_BUDGETS_QUERY_KEY, userId ?? 'guest'],
    queryFn: listHighlightBudgets,
    enabled: isEnabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    ...options,
  });
}
