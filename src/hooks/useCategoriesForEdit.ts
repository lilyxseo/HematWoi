import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category } from '../services/categories';
import { fetchCategoriesRaw, fetchCategoryById } from '../services/categories';

type TxTypeForHook = 'income' | 'expense' | 'transfer';

type CategoryOption = Category & { isFallback?: boolean };

type UseCategoriesForEditResult = {
  options: CategoryOption[];
  isLoading: boolean;
  ensureSelectedLoaded: (categoryId?: string | null) => Promise<void>;
};

type UseCategoriesForEditOptions = {
  allowFallback?: boolean;
};

export function useCategoriesForEdit(
  txType: TxTypeForHook,
  selectedCategoryId?: string | null,
  options?: UseCategoriesForEditOptions,
): UseCategoriesForEditResult {
  const allowFallback = options?.allowFallback ?? true;
  const isMountedRef = useRef(true);
  const [list, setList] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const selectedRef = useRef<string | undefined>(selectedCategoryId ?? undefined);
  const loadingRef = useRef(false);

  useEffect(() => {
    selectedRef.current = selectedCategoryId ?? undefined;
  }, [selectedCategoryId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadCategories = useCallback(
    async (type: 'income' | 'expense') => {
      if (loadingRef.current) {
        return;
      }
      loadingRef.current = true;
      if (isMountedRef.current) {
        setIsLoading(true);
      }
      try {
        const base = await fetchCategoriesRaw({ types: [type] });
        let next: CategoryOption[] = base.map((item) => ({ ...item }));
        const currentSelected = selectedRef.current;
        if (allowFallback && currentSelected && !next.some((item) => item.id === currentSelected)) {
          const fallback = await fetchCategoryById(currentSelected);
          if (fallback) {
            next = [...next, { ...fallback, isFallback: true }];
          }
        }
        if (isMountedRef.current) {
          setList(next);
        }
      } catch (error) {
        console.error('[categories:editHook] Failed to load categories', error);
        if (isMountedRef.current) {
          setList([]);
        }
      } finally {
        loadingRef.current = false;
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [allowFallback],
  );

  useEffect(() => {
    if (txType === 'transfer') {
      if (isMountedRef.current) {
        setList([]);
        setIsLoading(false);
      }
      return;
    }
    void loadCategories(txType);
  }, [loadCategories, txType]);

  const ensureSelectedLoaded = useCallback(
    async (categoryId?: string | null) => {
      const targetId = categoryId ?? selectedRef.current;
      if (!targetId || txType === 'transfer') {
        return;
      }
      if (list.some((item) => item.id === targetId)) {
        return;
      }
      try {
        const fallback = await fetchCategoryById(targetId);
        if (fallback && isMountedRef.current) {
          setList((prev) => {
            if (prev.some((item) => item.id === fallback.id)) {
              return prev;
            }
            return [...prev, { ...fallback, isFallback: true }];
          });
        }
      } catch (error) {
        console.error('[categories:editHook] Failed to ensure selected category', error);
      }
    },
    [list, txType],
  );

  return { options: list, isLoading, ensureSelectedLoaded };
}

export type { CategoryOption };
