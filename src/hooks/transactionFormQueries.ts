import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listAccounts } from '../lib/api';
import { getCurrentUserId } from '../lib/session';
import { supabase } from '../lib/supabase';
import { fetchCategoriesSafe } from '../services/categories';

type CategoryType = 'income' | 'expense';

const REFERENCE_STALE_TIME = 10 * 60 * 1000;
const REFERENCE_GC_TIME = 30 * 60 * 1000;

const REFERENCE_QUERY_OPTIONS = {
  staleTime: REFERENCE_STALE_TIME,
  gcTime: REFERENCE_GC_TIME,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
};

export const REFERENCE_ACCOUNTS_QUERY_KEY = ['reference', 'accounts'] as const;

export const getReferenceCategoriesQueryKey = (typesKey: string) =>
  ['reference', 'categories', typesKey] as const;

export const getTransactionDetailQueryKey = (transactionId: string) =>
  ['transactions', 'detail', transactionId] as const;

const normalizeTypesKey = (types?: CategoryType[] | string) => {
  if (typeof types === 'string') {
    return types || 'expense+income';
  }
  if (!types || types.length === 0) return 'expense+income';
  const deduped: CategoryType[] = [];
  types.forEach((item) => {
    if ((item === 'income' || item === 'expense') && !deduped.includes(item)) {
      deduped.push(item);
    }
  });
  return deduped.length ? deduped.join('+') : 'expense+income';
};

const parseTypesKey = (typesKey: string): CategoryType[] => {
  const parsed = typesKey.split('+').filter((value) => value === 'income' || value === 'expense');
  return parsed.length ? parsed : ['expense', 'income'];
};

const fetchCategoriesByKey = (typesKey: string) =>
  fetchCategoriesSafe({ types: parseTypesKey(typesKey) });

export function useAccountsQuery(options = {}) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: REFERENCE_ACCOUNTS_QUERY_KEY,
    queryFn: listAccounts,
    placeholderData: () => queryClient.getQueryData(REFERENCE_ACCOUNTS_QUERY_KEY) ?? [],
    ...REFERENCE_QUERY_OPTIONS,
    ...options,
  });
}

export function useCategoriesQuery(types?: CategoryType[], options = {}) {
  const queryClient = useQueryClient();
  const typesKey = useMemo(
    () => normalizeTypesKey(types),
    [Array.isArray(types) ? types.join('+') : types],
  );
  const queryKey = useMemo(() => getReferenceCategoriesQueryKey(typesKey), [typesKey]);
  return useQuery({
    queryKey,
    queryFn: () => fetchCategoriesByKey(typesKey),
    placeholderData: () => queryClient.getQueryData(queryKey) ?? [],
    ...REFERENCE_QUERY_OPTIONS,
    ...options,
  });
}

export async function fetchTransactionDetail(transactionId: string) {
  if (!transactionId) {
    throw new Error('Transaction ID is required');
  }
  const userId = await getCurrentUserId().catch(() => null);
  let builder = supabase
    .from('transactions')
    .select('id,user_id,type,category_id,amount,title,notes,date,account_id,to_account_id,receipt_url,merchant_id')
    .eq('id', transactionId);
  if (userId) {
    builder = builder.eq('user_id', userId);
  }
  const { data, error } = await builder.maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('Transaksi tidak ditemukan');
  }
  return data;
}

export async function prefetchReferenceData(
  queryClient: ReturnType<typeof useQueryClient>,
  types?: CategoryType[] | string,
) {
  const typesKey = normalizeTypesKey(types);
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: REFERENCE_ACCOUNTS_QUERY_KEY,
      queryFn: listAccounts,
      ...REFERENCE_QUERY_OPTIONS,
    }),
    queryClient.prefetchQuery({
      queryKey: getReferenceCategoriesQueryKey(typesKey),
      queryFn: () => fetchCategoriesByKey(typesKey),
      ...REFERENCE_QUERY_OPTIONS,
    }),
  ]);
}

export async function prefetchTransactionDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  transactionId: string,
) {
  if (!transactionId) return;
  await queryClient.prefetchQuery({
    queryKey: getTransactionDetailQueryKey(transactionId),
    queryFn: () => fetchTransactionDetail(transactionId),
  });
}
