import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchReferenceData, prefetchTransactionDetail } from './transactionFormQueries';

export function useTransactionFormPrefetch() {
  const queryClient = useQueryClient();

  const prefetchAddForm = useCallback(() => {
    void prefetchReferenceData(queryClient, 'expense+income');
  }, [queryClient]);

  const prefetchEditForm = useCallback(
    (transactionId: string, transactionType?: string) => {
      const typesKey =
        transactionType === 'income' || transactionType === 'expense'
          ? transactionType
          : 'expense+income';
      void prefetchReferenceData(queryClient, typesKey);
      void prefetchTransactionDetail(queryClient, transactionId);
    },
    [queryClient],
  );

  return {
    prefetchAddForm,
    prefetchEditForm,
  };
}
