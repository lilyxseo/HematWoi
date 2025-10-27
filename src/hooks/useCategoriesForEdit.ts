import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category } from '../services/categories';
import {
  fetchCategoriesRaw,
  fetchCategoryById,
} from '../services/categories';

export type TransactionCategoryType = 'income' | 'expense' | 'transfer';

type UseCategoriesForEditResult = {
  options: Category[];
  isLoading: boolean;
  error: Error | null;
  ensureSelectedLoaded: () => Promise<void>;
};

const ALLOWED_TYPES: TransactionCategoryType[] = ['income', 'expense', 'transfer'];

export default function useCategoriesForEdit(
  txType: TransactionCategoryType,
  selectedCategoryId?: string,
): UseCategoriesForEditResult {
  const [options, setOptions] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const normalizedType = useMemo(() => {
    if (!ALLOWED_TYPES.includes(txType)) {
      return 'transfer';
    }
    return txType;
  }, [txType]);

    const load = useCallback(async () => {
      if (normalizedType === 'transfer') {
        setOptions([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const rows = await fetchCategoriesRaw({ types: [normalizedType] });
        let next = [...rows];
        if (selectedCategoryId) {
          const hasSelected = next.some((row) => row.id === selectedCategoryId);
          if (!hasSelected) {
            const fallback = await fetchCategoryById(selectedCategoryId);
            if (fallback) {
              const label =
                fallback.type !== normalizedType ? `${fallback.name} (arsip)` : fallback.name;
              next = [...next, { ...fallback, name: label }];
            }
          }
        }
        setOptions(next);
      } catch (err) {
        console.error('[categories:editHook] Failed to load categories for edit', err);
        setError(err instanceof Error ? err : new Error('Gagal memuat kategori.'));
      } finally {
        setIsLoading(false);
      }
    }, [normalizedType, selectedCategoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ensureSelectedLoaded = useCallback(async () => {
    if (!selectedCategoryId) {
      return;
    }
    if (options.some((item) => item.id === selectedCategoryId)) {
      return;
    }
    if (normalizedType === 'transfer') {
      return;
    }

    try {
      const fallback = await fetchCategoryById(selectedCategoryId);
      if (!fallback) {
        return;
      }
      const label = fallback.type !== normalizedType ? `${fallback.name} (arsip)` : fallback.name;
      setOptions((prev) => {
        if (prev.some((item) => item.id === selectedCategoryId)) {
          return prev;
        }
        return [...prev, { ...fallback, name: label }];
      });
    } catch (err) {
      console.error('[categories:editHook] Failed to ensure selected category', err);
    }
  }, [normalizedType, options, selectedCategoryId]);

  return {
    options,
    isLoading,
    error,
    ensureSelectedLoaded,
  };
}

