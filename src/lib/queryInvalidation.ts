import type { QueryClient } from '@tanstack/react-query';

const DEBUG =
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
  process.env?.NODE_ENV === 'development';

type InvalidationKey = {
  key: readonly unknown[];
  label: string;
};

function logInvalidation(label: string, keys: InvalidationKey[]) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.debug('[query:invalidate]', label, keys.map((item) => item.key));
}

function invalidateKeys(queryClient: QueryClient, label: string, keys: InvalidationKey[]) {
  logInvalidation(label, keys);
  keys.forEach(({ key }) => {
    queryClient.invalidateQueries({ queryKey: key });
  });
}

const TRANSACTION_KEYS: InvalidationKey[] = [
  { key: ['transactions'], label: 'transactions' },
  { key: ['calendar-month'], label: 'calendar-month' },
  { key: ['calendar-day'], label: 'calendar-day' },
  { key: ['financial-insights'], label: 'financial-insights' },
  { key: ['reports-pro'], label: 'reports-pro' },
  { key: ['financial-health', 'transactions'], label: 'financial-health-transactions' },
];

const CATEGORY_KEYS: InvalidationKey[] = [
  { key: ['reference', 'categories'], label: 'reference-categories' },
  { key: ['transactions', 'categories'], label: 'transactions-categories' },
  { key: ['financial-health', 'categories'], label: 'financial-health-categories' },
  { key: ['reports-pro', 'categories'], label: 'reports-pro-categories' },
];

const BUDGET_KEYS: InvalidationKey[] = [
  { key: ['financial-insights', 'budgets'], label: 'financial-insights-budgets' },
  { key: ['financial-health', 'budgets'], label: 'financial-health-budgets' },
  { key: ['budgets', 'highlights'], label: 'budgets-highlights' },
];

const GOAL_KEYS: InvalidationKey[] = [
  { key: ['financial-health', 'goals'], label: 'financial-health-goals' },
];

export function invalidateTransactionQueries(queryClient: QueryClient) {
  invalidateKeys(queryClient, 'transactions', TRANSACTION_KEYS);
}

export function invalidateCategoryQueries(queryClient: QueryClient) {
  invalidateKeys(queryClient, 'categories', CATEGORY_KEYS);
}

export function invalidateBudgetQueries(queryClient: QueryClient) {
  invalidateKeys(queryClient, 'budgets', BUDGET_KEYS);
}

export function invalidateGoalQueries(queryClient: QueryClient) {
  invalidateKeys(queryClient, 'goals', GOAL_KEYS);
}
