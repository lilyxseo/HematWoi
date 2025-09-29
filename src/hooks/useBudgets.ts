import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buildBudgetSummary,
  createBudget,
  deleteBudget,
  listBudgetCategories,
  listBudgetsWithActual,
  updateBudget,
  type BudgetMutationPayload,
  type BudgetSummarySnapshot,
  type BudgetTypeFilter,
  type BudgetWithActual,
  type UpdateBudgetPayload,
  type BudgetCategoryInfo,
} from '../lib/budgetsApi';

export const budgetKeys = {
  all: ['budgets'] as const,
  list: (period: string) => ['budgets', 'list', period] as const,
  categories: (type: BudgetTypeFilter) => ['budgets', 'categories', type] as const,
};

export interface UseBudgetsOptions {
  period: string;
  enabled?: boolean;
}

export interface UseBudgetsResult {
  budgets: BudgetWithActual[];
  summary: BudgetSummarySnapshot;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise<unknown>;
}

export function useBudgets({ period, enabled = true }: UseBudgetsOptions): UseBudgetsResult {
  const query = useQuery({
    queryKey: budgetKeys.list(period),
    queryFn: ({ signal }) => listBudgetsWithActual({ period, signal }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: Boolean(period) && enabled,
  });

  const budgets = query.data ?? [];
  const summary = useMemo(() => buildBudgetSummary(budgets), [budgets]);
  const error = query.error instanceof Error ? query.error.message : null;

  return {
    budgets,
    summary,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error,
    refetch: async () => {
      const result = await query.refetch();
      return result.data ?? [];
    },
  };
}

export function useBudgetCategories(type: BudgetTypeFilter = 'expense') {
  const query = useQuery({
    queryKey: budgetKeys.categories(type),
    queryFn: ({ signal }) => listBudgetCategories(type, signal),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  return {
    categories: (query.data ?? []) as BudgetCategoryInfo[],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

export function useBudgetMutations(period: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: budgetKeys.list(period),
    });

  const createMutation = useMutation({
    mutationFn: (payload: BudgetMutationPayload) => createBudget(payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateBudgetPayload) => updateBudget(payload),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: invalidate,
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation: removeMutation,
  };
}
