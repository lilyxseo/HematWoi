import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '../services/categories';
import {
  fetchCategoriesRaw,
  fetchCategoryById,
} from '../services/categories';

type TxType = 'income' | 'expense' | 'transfer';

export type CategoryOption = Category & {
  isFallback?: boolean;
};

type UseCategoriesForEditResult = {
  options: CategoryOption[];
  isLoading: boolean;
  ensureSelectedLoaded: (categoryId?: string | null) => Promise<void>;
};

export default function useCategoriesForEdit(
  txType: TxType,
  selectedCategoryId?: string | null,
): UseCategoriesForEditResult {
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const mountedRef = useRef(true);
  const selectedRef = useRef<string | null | undefined>(selectedCategoryId);
  const optionsRef = useRef<CategoryOption[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const normalizedType = useMemo<TxType>(() => {
    if (txType === 'income' || txType === 'expense' || txType === 'transfer') {
      return txType;
    }
    return 'expense';
  }, [txType]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const ensureSelectedLoaded = useCallback(
    async (categoryId?: string | null) => {
      const id = categoryId ?? selectedRef.current;
      if (!id || normalizedType === 'transfer') {
        return;
      }

      selectedRef.current = id;

      if (optionsRef.current.some((item) => item.id === id)) {
        return;
      }

      try {
        const category = await fetchCategoryById(id);
        if (!category || !mountedRef.current) {
          return;
        }

        setOptions((prev) => {
          if (prev.some((item) => item.id === id)) {
            return prev;
          }
          return [...prev, { ...category, isFallback: true }];
        });
      } catch (error) {
        console.error('[categories:editHook] Failed to ensure selected category', error);
      }
    },
    [normalizedType],
  );

  useEffect(() => {
    selectedRef.current = selectedCategoryId;
  }, [selectedCategoryId]);

  useEffect(() => {
    if (normalizedType === 'transfer') {
      setOptions([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const rows = await fetchCategoriesRaw({ types: [normalizedType] });
        if (cancelled || !mountedRef.current) {
          return;
        }
        setOptions(rows);
        await ensureSelectedLoaded(selectedRef.current);
      } catch (error) {
        if (!cancelled) {
          console.error('[categories:editHook] Failed to load categories', error);
          setOptions([]);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureSelectedLoaded, normalizedType]);

  useEffect(() => {
    if (!selectedCategoryId) {
      return;
    }
    void ensureSelectedLoaded(selectedCategoryId);
  }, [ensureSelectedLoaded, selectedCategoryId]);

  return {
    options,
    isLoading,
    ensureSelectedLoaded,
  };
}
